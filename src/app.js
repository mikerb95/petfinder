const express = require('express');
const path = require('path');
const config = require('./config');
const { getPool } = require('./db');
const { requireAuth } = require('./middleware/auth');
const QRCode = require('qrcode');
const { randomId } = require('./utils/id');
const authRoutes = require('./routes/auth');

const app = express();

// Landing y assets estaticos (Vercel sirve /public en produccion, aqui no afecta)
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir, { extensions: ['html'] }));

// Parseo de cuerpo
app.use(express.json());

// Rutas API
app.use('/api/auth', authRoutes);

// Verificacion de salud (sin DB)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: config.env });
});

// Verificacion de salud de DB
app.get('/api/db/health', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT 1 AS ok');
    return res.json({ status: 'ok', db: 'mysql', ok: rows?.[0]?.ok === 1 });
  } catch (err) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
});

// Autenticado: perfil de usuario actual
app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.sub;
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT id, name, last_name, sex, email, phone, city, instagram_url, facebook_url, whatsapp_url, created_at FROM users WHERE id = ?',
      [userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'user not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'internal server error' });
  }
});

// Actualizar perfil de usuario actual
app.put('/api/me', requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.sub;
  const { name, last_name, sex, email, phone, city, instagram_url, facebook_url, whatsapp_url } = req.body || {};
    if (email && typeof email !== 'string') return res.status(400).json({ error: 'email invalido' });
    if (name && typeof name !== 'string') return res.status(400).json({ error: 'nombre invalido' });
    if (last_name && typeof last_name !== 'string') return res.status(400).json({ error: 'apellido invalido' });
    if (sex && !['unknown','male','female'].includes(String(sex))) return res.status(400).json({ error: 'sexo invalido' });
    const pool = getPool();
    // Si el email cambia, verificar que no este en uso por otro usuario
    if (email) {
      const [dupe] = await pool.query('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1', [email, userId]);
      if (dupe.length) return res.status(409).json({ error: 'el correo ya está registrado' });
    }
    await pool.query(
      `UPDATE users SET
         name = COALESCE(?, name),
         last_name = COALESCE(?, last_name),
         sex = COALESCE(?, sex),
         email = COALESCE(?, email),
         phone = COALESCE(?, phone),
         city = COALESCE(?, city),
         instagram_url = COALESCE(?, instagram_url),
         facebook_url = COALESCE(?, facebook_url),
         whatsapp_url = COALESCE(?, whatsapp_url)
       WHERE id = ?`,
      [name ?? null, (last_name ?? null), (sex ?? null), (email ?? null), (phone ?? null), (city ?? null), (instagram_url ?? null), (facebook_url ?? null), (whatsapp_url ?? null), userId]
    );
    const [rows] = await pool.query('SELECT id, name, last_name, sex, email, phone, city, instagram_url, facebook_url, whatsapp_url, created_at FROM users WHERE id = ?', [userId]);
    if (!rows.length) return res.status(404).json({ error: 'user not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      return res.status(500).json({ error: 'internal server error', detail: err.code || err.message });
    }
    res.status(500).json({ error: 'internal server error' });
  }
});

// (QR de dueno y pagina publica de dueno removidos segun requisitos)

// -------- API de mascotas (CRUD + QR) --------

// Listar mascotas del usuario actual
app.get('/api/pets', requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.sub;
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, name, species, breed, color, city, notes, status, photo_url,
              birthdate, sex, weight_kg, sterilized, microchip_id,
              allergies, medical_conditions, medications,
              last_vet_visit, vet_clinic_name, vet_clinic_phone, vaccine_card_url,
              qr_id, created_at, updated_at
         FROM pets
        WHERE owner_id = ?
        ORDER BY created_at DESC`,
      [userId]
    );
    res.json({ pets: rows });
  } catch (err) {
    res.status(500).json({ error: 'internal server error' });
  }
});

// Crear mascota
app.post('/api/pets', requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.sub;
    const {
      name, species, breed, color, city, notes, status, photo_url,
      birthdate, sex, weight_kg, sterilized, microchip_id,
      allergies, medical_conditions, medications,
      last_vet_visit, vet_clinic_name, vet_clinic_phone, vaccine_card_url
    } = req.body || {};
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name is required' });
    if (!city || typeof city !== 'string') return res.status(400).json({ error: 'city is required' });
    if (status && !['home', 'lost'].includes(status)) return res.status(400).json({ error: 'invalid status' });

    const pool = getPool();
    let qrId;
    let attempts = 0;
    while (attempts < 5) {
      attempts++;
      qrId = randomId(12);
      try {
        const [result] = await pool.query(
          `INSERT INTO pets (
            owner_id, name, species, breed, color, city, notes, status, photo_url,
            birthdate, sex, weight_kg, sterilized, microchip_id,
            allergies, medical_conditions, medications,
            last_vet_visit, vet_clinic_name, vet_clinic_phone, vaccine_card_url,
            qr_id, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, NOW()
          )`,
          [
            userId, name, species || null, breed || null, color || null, city, notes || null, status || 'home', photo_url || null,
            birthdate || null, (sex || 'unknown'), (weight_kg ?? null), (sterilized ? 1 : 0), microchip_id || null,
            allergies || null, medical_conditions || null, medications || null,
            last_vet_visit || null, vet_clinic_name || null, vet_clinic_phone || null, vaccine_card_url || null,
            qrId
          ]
        );
        return res.status(201).json({ id: result.insertId, qr_id: qrId });
      } catch (e) {
  // Codigo ER_DUP_ENTRY para mysql2
        if (e && e.code === 'ER_DUP_ENTRY') continue;
        throw e;
      }
    }
    return res.status(500).json({ error: 'could not generate unique qr id' });
  } catch (err) {
    if (config.env !== 'production') {
      return res.status(500).json({ error: 'internal server error', detail: err.code || err.message });
    }
    res.status(500).json({ error: 'internal server error' });
  }
});

// Actualizar mascota (solo dueno)
app.put('/api/pets/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.sub;
    const { id } = req.params;
    const {
      name, species, breed, color, city, notes, status, photo_url,
      birthdate, sex, weight_kg, sterilized, microchip_id,
      allergies, medical_conditions, medications,
      last_vet_visit, vet_clinic_name, vet_clinic_phone, vaccine_card_url
    } = req.body || {};
    const pool = getPool();
  // Verificar propiedad
    const [rows] = await pool.query('SELECT id FROM pets WHERE id = ? AND owner_id = ?', [id, userId]);
    if (!rows.length) return res.status(404).json({ error: 'pet not found' });

    if (status && !['home', 'lost'].includes(status)) return res.status(400).json({ error: 'invalid status' });

    await pool.query(
      `UPDATE pets SET
         name = COALESCE(?, name),
         species = COALESCE(?, species),
         breed = COALESCE(?, breed),
         color = COALESCE(?, color),
         city = COALESCE(?, city),
         notes = COALESCE(?, notes),
         status = COALESCE(?, status),
         photo_url = COALESCE(?, photo_url),
         birthdate = COALESCE(?, birthdate),
         sex = COALESCE(?, sex),
         weight_kg = COALESCE(?, weight_kg),
         sterilized = COALESCE(?, sterilized),
         microchip_id = COALESCE(?, microchip_id),
         allergies = COALESCE(?, allergies),
         medical_conditions = COALESCE(?, medical_conditions),
         medications = COALESCE(?, medications),
         last_vet_visit = COALESCE(?, last_vet_visit),
         vet_clinic_name = COALESCE(?, vet_clinic_name),
         vet_clinic_phone = COALESCE(?, vet_clinic_phone),
         vaccine_card_url = COALESCE(?, vaccine_card_url),
         updated_at = NOW()
       WHERE id = ?`,
      [
        name ?? null, species ?? null, breed ?? null, color ?? null, city ?? null, notes ?? null, status ?? null, photo_url ?? null,
        birthdate ?? null, sex ?? null, (weight_kg ?? null), (typeof sterilized === 'boolean' ? (sterilized ? 1 : 0) : sterilized ?? null), microchip_id ?? null,
        allergies ?? null, medical_conditions ?? null, medications ?? null,
        last_vet_visit ?? null, vet_clinic_name ?? null, vet_clinic_phone ?? null, vaccine_card_url ?? null,
        id
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'internal server error' });
  }
});

// Eliminar mascota (solo dueno)
app.delete('/api/pets/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.sub;
    const { id } = req.params;
    const pool = getPool();
    const [rows] = await pool.query('SELECT id FROM pets WHERE id = ? AND owner_id = ?', [id, userId]);
    if (!rows.length) return res.status(404).json({ error: 'pet not found' });
    await pool.query('DELETE FROM pets WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'internal server error' });
  }
});

// QR de mascota (SVG)
app.get('/api/qr/pet/:qrId.svg', async (req, res) => {
  try {
    const { qrId } = req.params;
    const url = new URL('/p/' + qrId, config.appBaseUrl).toString();
    const svg = await QRCode.toString(url, { type: 'svg', margin: 1 });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (err) {
    res.status(500).json({ error: 'qr generation failed' });
  }
});

// QR de mascota (PNG)
app.get('/api/qr/pet/:qrId.png', async (req, res) => {
  try {
    const { qrId } = req.params;
    const url = new URL('/p/' + qrId, config.appBaseUrl).toString();
    const buf = await QRCode.toBuffer(url, { type: 'png', margin: 1, scale: 8 });
    res.setHeader('Content-Type', 'image/png');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: 'qr generation failed' });
  }
});

// JSON publico: detalles de mascota por qrId
app.get('/api/pets/public/:qrId', async (req, res) => {
  try {
    const { qrId } = req.params;
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT p.name AS pet_name, p.species, p.breed, p.color, p.city, p.notes, p.status, p.photo_url,
              u.name AS owner_name, u.phone AS owner_phone, u.email AS owner_email,
              u.instagram_url AS owner_instagram, u.facebook_url AS owner_facebook, u.whatsapp_url AS owner_whatsapp
         FROM pets p
         JOIN users u ON u.id = p.owner_id
        WHERE p.qr_id = ?
        LIMIT 1`,
      [qrId]
    );
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    const r = rows[0];
    res.json({
      pet: {
        name: r.pet_name || '',
        species: r.species || null,
        breed: r.breed || null,
        color: r.color || null,
        city: r.city || null,
        notes: r.notes || null,
        status: r.status || 'home',
        photo_url: r.photo_url || null,
      },
      owner: {
        name: r.owner_name || '',
        phone: r.owner_phone || null,
        email: r.owner_email || null,
        instagram_url: r.owner_instagram || null,
        facebook_url: r.owner_facebook || null,
        whatsapp_url: r.owner_whatsapp || null,
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'internal server error' });
  }
});

// Paginas estaticas para login/registro
app.get('/login', (req, res) => {
  res.sendFile(path.join(publicDir, 'login.html'));
});
app.get('/register', (req, res) => {
  res.sendFile(path.join(publicDir, 'register.html'));
});
app.get('/forgot', (req, res) => {
  res.sendFile(path.join(publicDir, 'forgot.html'));
});
app.get('/reset', (req, res) => {
  res.sendFile(path.join(publicDir, 'reset.html'));
});
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(publicDir, 'dashboard.html'));
});
// Pagina de escaner QR
app.get('/scan', (req, res) => {
  res.sendFile(path.join(publicDir, 'scan.html'));
});
// Pagina de kickoff
app.get('/kickoff', (req, res) => {
  res.sendFile(path.join(publicDir, 'kickoff.html'));
});
// Pagina de terminos
app.get('/terms', (req, res) => {
  res.sendFile(path.join(publicDir, 'terms.html'));
});
// Pagina de privacidad
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(publicDir, 'privacy.html'));
});
// Pagina publica de mascota por qrId (sirve pagina estatica que obtiene JSON)
app.get('/p/:qrId', (req, res) => {
  res.sendFile(path.join(publicDir, 'pet.html'));
});

// Raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

module.exports = app;
