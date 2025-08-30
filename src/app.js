const express = require('express');
const path = require('path');
const config = require('./config');
const { getPool } = require('./db');
const { requireAuth } = require('./middleware/auth');
const QRCode = require('qrcode');
const { randomId } = require('./utils/id');
const authRoutes = require('./routes/auth');
const { requireAdmin } = require('./middleware/admin');
const jwt = require('jsonwebtoken');

const app = express();

// Landing y assets estaticos (Vercel sirve /public en produccion, aqui no afecta)
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir, { extensions: ['html'] }));

// Parseo de cuerpo
app.use(express.json());

// --- util cookie parsing for simple cart sessions ---
function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach(kv => {
    const idx = kv.indexOf('=');
    if (idx > -1) {
      const k = kv.slice(0, idx).trim();
      const v = decodeURIComponent(kv.slice(idx + 1).trim());
      if (k) out[k] = v;
    }
  });
  return out;
}
async function getOrCreateCart(req, res) {
  const pool = getPool();
  let cookies = parseCookies(req);
  let sid = cookies['pf_cart'] || null;
  let cartId = null;
  if (sid) {
    const [r] = await pool.query('SELECT id FROM carts WHERE session_id = ? LIMIT 1', [sid]);
    if (r.length) cartId = r[0].id;
  }
  if (!cartId) {
    sid = 'sid_' + randomId(24);
    const [c] = await pool.query('INSERT INTO carts (session_id) VALUES (?)', [sid]);
    cartId = c.insertId;
    const cookie = `pf_cart=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`;
    res.setHeader('Set-Cookie', cookie);
  }
  return { cartId, sessionId: sid };
}

// Rutas API
app.use('/api/auth', authRoutes);
// Endpoint DEV para promover a admin (no disponible en produccion)
if (config.env !== 'production') {
  app.post('/api/admin/dev/promote', async (req, res) => {
    try {
      const { email, key } = req.body || {};
      if (!email || !key) return res.status(400).json({ error: 'email y key son obligatorios' });
      if (!process.env.DEV_ADMIN_KEY || key !== process.env.DEV_ADMIN_KEY) {
        return res.status(401).json({ error: 'clave invalida' });
      }
      const pool = getPool();
      const [rows] = await pool.query('SELECT id, is_admin FROM users WHERE email = ? LIMIT 1', [email]);
      if (!rows.length) return res.status(404).json({ error: 'usuario no encontrado' });
      await pool.query('UPDATE users SET is_admin = 1 WHERE id = ?', [rows[0].id]);
      return res.json({ ok: true, user_id: rows[0].id });
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        return res.status(500).json({ error: 'internal server error', detail: err.message });
      }
      return res.status(500).json({ error: 'internal server error' });
    }
  });
}
// --- CMS Productos (admin) ---
app.get('/api/admin/products', requireAuth, requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT id, name, slug, price_cents, currency, stock, active, image_url, description, created_at, updated_at FROM products ORDER BY created_at DESC');
    res.json({ products: rows });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

app.post('/api/admin/products', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, slug, price_cents, currency, stock, active, image_url, description } = req.body || {};
    if (!name || !slug || typeof price_cents !== 'number') return res.status(400).json({ error: 'name, slug y price_cents son obligatorios' });
    const pool = getPool();
    const [r] = await pool.query(
      'INSERT INTO products (name, slug, price_cents, currency, stock, active, image_url, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, slug, price_cents, currency || 'COP', stock ?? 0, active ? 1 : 0, image_url || null, description || null]
    );
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'slug ya existe' });
    res.status(500).json({ error: 'internal server error' });
  }
});

app.put('/api/admin/products/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, price_cents, currency, stock, active, image_url, description } = req.body || {};
    const pool = getPool();
    await pool.query(
      `UPDATE products SET
        name = COALESCE(?, name),
        slug = COALESCE(?, slug),
        price_cents = COALESCE(?, price_cents),
        currency = COALESCE(?, currency),
        stock = COALESCE(?, stock),
        active = COALESCE(?, active),
        image_url = COALESCE(?, image_url),
        description = COALESCE(?, description),
        updated_at = NOW()
      WHERE id = ?`,
      [name ?? null, slug ?? null, price_cents ?? null, currency ?? null, stock ?? null, (typeof active === 'boolean' ? (active ? 1 : 0) : active ?? null), image_url ?? null, description ?? null, id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

app.delete('/api/admin/products/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    await pool.query('DELETE FROM products WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

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

// Contact form endpoint (sends email via Resend if configured; otherwise no-op)
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body || {};
    if (!name || !email || !message) return res.status(400).json({ error: 'nombre, correo y mensaje son obligatorios' });
    let ResendClient = null;
    try { ResendClient = require('resend').Resend; } catch(_) {}
    const RK = process.env.RESEND_API_KEY;
    const TO = process.env.CONTACT_TO || process.env.FROM_EMAIL || 'mikerb95@gmail.com';
    const FROM = process.env.FROM_EMAIL || 'no-reply@petfinder.local';
    if (ResendClient && RK && process.env.NODE_ENV === 'production') {
      try {
        const resend = new ResendClient(RK);
        const subject = `Nuevo mensaje de contacto — ${name}`;
        const html = `
          <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">
            <h2>Contacto Petfinder</h2>
            <p><strong>Nombre:</strong> ${String(name).replace(/</g,'&lt;')}</p>
            <p><strong>Correo:</strong> ${String(email).replace(/</g,'&lt;')}</p>
            <p><strong>Mensaje:</strong></p>
            <div style="white-space:pre-wrap;border:1px solid #e5e7eb;border-radius:8px;padding:12px;background:#f9fafb;color:#111">${String(message).replace(/</g,'&lt;')}</div>
          </div>`;
        await resend.emails.send({ from: FROM, to: TO, subject, html });
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') console.warn('contact email error:', e?.message);
      }
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'internal server error' });
  }
});

// Autenticado: perfil de usuario actual
app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.sub;
    const pool = getPool();
    const [rows] = await pool.query(
  'SELECT id, name, last_name, sex, email, phone, city, instagram_url, facebook_url, whatsapp_url, is_admin, created_at FROM users WHERE id = ?',
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
      qr_id, nfc_id, created_at, updated_at
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
            qr_id, nfc_id, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, NOW()
          )`,
          [
            userId, name, species || null, breed || null, color || null, city, notes || null, status || 'home', photo_url || null,
            birthdate || null, (sex || 'unknown'), (weight_kg ?? null), (sterilized ? 1 : 0), microchip_id || null,
            allergies || null, medical_conditions || null, medications || null,
            last_vet_visit || null, vet_clinic_name || null, vet_clinic_phone || null, vaccine_card_url || null,
            qrId, null
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
     nfc_id = COALESCE(?, nfc_id),
         updated_at = NOW()
       WHERE id = ?`,
      [
        name ?? null, species ?? null, breed ?? null, color ?? null, city ?? null, notes ?? null, status ?? null, photo_url ?? null,
        birthdate ?? null, sex ?? null, (weight_kg ?? null), (typeof sterilized === 'boolean' ? (sterilized ? 1 : 0) : sterilized ?? null), microchip_id ?? null,
        allergies ?? null, medical_conditions ?? null, medications ?? null,
    last_vet_visit ?? null, vet_clinic_name ?? null, vet_clinic_phone ?? null, vaccine_card_url ?? null, (req.body?.nfc_id ?? null),
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

// ---- Adopciones / transferencias ----
// Transferir mascota a otro usuario (por email del adoptante)
app.post('/api/pets/:id/transfer', requireAuth, async (req, res) => {
  try {
    const ownerId = req.auth?.sub;
    const { id } = req.params;
    const { adopter_email, adoption_date, notes } = req.body || {};
    const pool = getPool();
    // check ownership
    const [rows] = await pool.query('SELECT id FROM pets WHERE id = ? AND owner_id = ?', [id, ownerId]);
    if (!rows.length) return res.status(404).json({ error: 'pet not found' });
    // find adopter
    const [u] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [adopter_email]);
    if (!u.length) return res.status(404).json({ error: 'adopter not found' });
    const adopterId = u[0].id;
    // record adoption and transfer ownership
    await pool.query('INSERT INTO adoptions (pet_id, adopter_id, adoption_date, notes) VALUES (?, ?, ?, ?)', [id, adopterId, adoption_date || new Date(), notes || null]);
    await pool.query('UPDATE pets SET owner_id = ? WHERE id = ?', [adopterId, id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

// ---- Reportes de perdidas ----
app.post('/api/pets/:id/lost-reports', requireAuth, async (req, res) => {
  try {
    const reporterId = req.auth?.sub;
    const { id } = req.params;
    const { last_seen_location, notes } = req.body || {};
    const pool = getPool();
    const [p] = await pool.query('SELECT id FROM pets WHERE id = ? AND owner_id = ?', [id, reporterId]);
    if (!p.length) return res.status(404).json({ error: 'pet not found' });
    const [r] = await pool.query('INSERT INTO lost_reports (pet_id, reporter_id, last_seen_location, notes) VALUES (?, ?, ?, ?)', [id, reporterId, last_seen_location, notes || null]);
    res.status(201).json({ id: r.insertId });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});
app.patch('/api/lost-reports/:reportId', requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.sub;
    const { reportId } = req.params;
    const { status, notes } = req.body || {};
    const pool = getPool();
    const [rows] = await pool.query('SELECT lr.id FROM lost_reports lr JOIN pets p ON p.id = lr.pet_id WHERE lr.id = ? AND p.owner_id = ?', [reportId, userId]);
    if (!rows.length) return res.status(404).json({ error: 'report not found' });
    if (status && !['active','found','closed'].includes(status)) return res.status(400).json({ error: 'invalid status' });
    await pool.query('UPDATE lost_reports SET status = COALESCE(?, status), notes = COALESCE(?, notes) WHERE id = ?', [status ?? null, notes ?? null, reportId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

// ---- Fotos adicionales ----
app.get('/api/pets/:id/photos', requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.sub;
    const { id } = req.params;
    const pool = getPool();
    const [own] = await pool.query('SELECT id FROM pets WHERE id = ? AND owner_id = ?', [id, userId]);
    if (!own.length) return res.status(404).json({ error: 'pet not found' });
    const [rows] = await pool.query('SELECT id, photo_url, uploaded_at FROM pet_photos WHERE pet_id = ? ORDER BY uploaded_at DESC', [id]);
    res.json({ photos: rows });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});
app.post('/api/pets/:id/photos', requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.sub;
    const { id } = req.params;
    const { photo_url } = req.body || {};
    const pool = getPool();
    const [own] = await pool.query('SELECT id FROM pets WHERE id = ? AND owner_id = ?', [id, userId]);
    if (!own.length) return res.status(404).json({ error: 'pet not found' });
    const [r] = await pool.query('INSERT INTO pet_photos (pet_id, photo_url) VALUES (?, ?)', [id, photo_url]);
    res.status(201).json({ id: r.insertId });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

// ---- Check-ins ----
app.post('/api/pets/:id/checkins', requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.sub;
    const { id } = req.params;
    const { location, notes } = req.body || {};
    const pool = getPool();
    const [exist] = await pool.query('SELECT id FROM pets WHERE id = ?', [id]);
    if (!exist.length) return res.status(404).json({ error: 'pet not found' });
    const [r] = await pool.query('INSERT INTO pet_checkins (pet_id, user_id, location, notes) VALUES (?, ?, ?, ?)', [id, userId, location || null, notes || null]);
    res.status(201).json({ id: r.insertId });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
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
// Admin CMS simple de productos
app.get('/admin/products', (req, res) => {
  res.sendFile(path.join(publicDir, 'admin-products.html'));
});
// Admin Blog (moderación y taxonomía)
app.get('/admin/blog', (req, res) => {
  res.sendFile(path.join(publicDir, 'admin-blog.html'));
});
// Pagina de escaner QR
app.get('/scan', (req, res) => {
  res.sendFile(path.join(publicDir, 'scan.html'));
});
// Pagina movil principal de escaneo
app.get('/m', (req, res) => {
  res.sendFile(path.join(publicDir, 'm.html'));
});
// Tienda publica (lista de productos)
app.get('/shop', (req, res) => {
  res.sendFile(path.join(publicDir, 'shop.html'));
});
// Detalle de producto por slug
app.get('/shop/:slug', (req, res) => {
  res.sendFile(path.join(publicDir, 'shop_product.html'));
});
// Carrito / Checkout / Pago / Confirmación
app.get('/cart', (req, res) => {
  res.sendFile(path.join(publicDir, 'cart.html'));
});
app.get('/checkout', (req, res) => {
  res.sendFile(path.join(publicDir, 'checkout.html'));
});
app.get('/payment', (req, res) => {
  res.sendFile(path.join(publicDir, 'payment.html'));
});
app.get('/order_confirmed', (req, res) => {
  res.sendFile(path.join(publicDir, 'order_confirmed.html'));
});
// Lookup de orden pública
app.get('/order_lookup', (req, res) => {
  res.sendFile(path.join(publicDir, 'order_lookup.html'));
});
// Pagina de detalles tecnicos
app.get('/tech', (req, res) => {
  res.sendFile(path.join(publicDir, 'tech.html'));
});
// Pagina de kickoff
app.get('/kickoff', (req, res) => {
  res.sendFile(path.join(publicDir, 'kickoff.html'));
});
// PetBnB (Guardería)
app.get('/bnb', (req, res) => {
  res.sendFile(path.join(publicDir, 'bnb.html'));
});
// Pagina de contacto
app.get('/contact', (req, res) => {
  res.sendFile(path.join(publicDir, 'contact.html'));
});
// Pagina de terminos
app.get('/terms', (req, res) => {
  res.sendFile(path.join(publicDir, 'terms.html'));
});
// Pagina de privacidad
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(publicDir, 'privacy.html'));
});
// Blog: listado, editor y detalle (páginas)
app.get('/blog', (req, res) => {
  res.sendFile(path.join(publicDir, 'blog.html'));
});
app.get('/blog/editor', (req, res) => {
  res.sendFile(path.join(publicDir, 'blog_editor.html'));
});
app.get('/blog/:slug', (req, res) => {
  res.sendFile(path.join(publicDir, 'blog_post.html'));
});
// Pagina publica de mascota por qrId (sirve pagina estatica que obtiene JSON)
app.get('/p/:qrId', (req, res) => {
  res.sendFile(path.join(publicDir, 'pet.html'));
});

// Licencia (texto)
app.get('/license', (req, res) => {
  res.type('text/plain');
  res.sendFile(path.join(__dirname, '..', 'LICENSE'));
});

// -------- API publica de tienda --------
// Listado de productos activos
app.get('/api/shop/products', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT id, name, slug, price_cents, currency, stock, image_url, description FROM products WHERE active = 1 ORDER BY created_at DESC'
    );
    res.json({ products: rows });
  } catch (err) {
    res.status(500).json({ error: 'internal server error' });
  }
});

// -------- PetBnB API (sitters, bookings) --------
// Listado de cuidadores públicos (filtros básicos)
app.get('/api/bnb/sitters', async (req, res) => {
  try {
    const { city = '', service = '' } = req.query || {};
    const pool = getPool();
    let sql = 'SELECT id, name, city, services, experience_years, photo_url, rating, reviews_count FROM bnb_sitters WHERE active = 1';
    const args = [];
    if (city) { sql += ' AND city LIKE ?'; args.push('%' + city + '%'); }
    if (service) { sql += ' AND FIND_IN_SET(?, REPLACE(services, \' \, \'\')) > 0'; args.push(service); }
    sql += ' ORDER BY rating DESC, reviews_count DESC, id DESC LIMIT 100';
    const [rows] = await pool.query(sql, args);
    res.json({ sitters: rows });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

// Crear una reserva (dueño autenticado)
app.post('/api/bnb/bookings', requireAuth, async (req, res) => {
  try {
    const ownerId = req.auth?.sub;
    const { sitter_id, start_date, end_date, notes } = req.body || {};
    if (!sitter_id || !start_date || !end_date) return res.status(400).json({ error: 'sitter_id, start_date y end_date son obligatorios' });
    const pool = getPool();
    // validar cuidador activo
    const [s] = await pool.query('SELECT id FROM bnb_sitters WHERE id = ? AND active = 1 LIMIT 1', [sitter_id]);
    if (!s.length) return res.status(404).json({ error: 'cuidador no disponible' });
    const [r] = await pool.query(
      'INSERT INTO bnb_bookings (owner_id, sitter_id, start_date, end_date, status, notes) VALUES (?, ?, ?, ?, \'pending\', ?)',
      [ownerId, sitter_id, start_date, end_date, notes || null]
    );
    res.status(201).json({ id: r.insertId });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});
// Detalle por slug (solo activos)
app.get('/api/shop/products/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT id, name, slug, price_cents, currency, stock, image_url, description FROM products WHERE slug = ? AND active = 1 LIMIT 1',
      [slug]
    );
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.json({ product: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'internal server error' });
  }
});

// -------- API Carrito (session cookie pf_cart) --------
app.get('/api/cart', async (req, res) => {
  try {
    const pool = getPool();
    const { cartId } = await getOrCreateCart(req, res);
    const [rows] = await pool.query(
      `SELECT ci.product_id, ci.variant_id, ci.quantity,
              COALESCE(ci.unit_price_cents, p.price_cents) AS price_cents,
              COALESCE(ci.currency, p.currency) AS currency,
              p.name, p.image_url, p.stock
         FROM cart_items ci
         LEFT JOIN products p ON p.id = ci.product_id
        WHERE ci.cart_id = ?
        ORDER BY ci.added_at DESC`, [cartId]);
    res.json({ items: rows });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

app.post('/api/cart', async (req, res) => {
  try {
    const { product_id, slug, variant_id = null, quantity = 1 } = req.body || {};
    const q = Math.max(1, Number(quantity || 1));
    const pool = getPool();
    const { cartId } = await getOrCreateCart(req, res);
    // resolve product
    let pRow = null;
    if (product_id) {
      const [r] = await pool.query('SELECT id, price_cents, currency, stock, active FROM products WHERE id = ? LIMIT 1', [product_id]);
      pRow = r[0];
    } else if (slug) {
      const [r] = await pool.query('SELECT id, price_cents, currency, stock, active FROM products WHERE slug = ? LIMIT 1', [slug]);
      pRow = r[0];
    }
    if (!pRow) return res.status(404).json({ error: 'producto no encontrado' });
    if (pRow.active !== 1) return res.status(400).json({ error: 'producto inactivo' });
    // upsert item
    const [ex] = await pool.query('SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? AND IFNULL(variant_id,0) = IFNULL(?,0) LIMIT 1', [cartId, pRow.id, variant_id]);
    const newQty = Math.min(99, (ex[0]?.quantity || 0) + q);
    if (ex.length) {
      await pool.query('UPDATE cart_items SET quantity = ?, unit_price_cents = ?, currency = ? WHERE id = ?', [newQty, pRow.price_cents, pRow.currency, ex[0].id]);
    } else {
      await pool.query(
        'INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, unit_price_cents, currency) VALUES (?, ?, ?, ?, ?, ?)',
        [cartId, pRow.id, variant_id || null, newQty, pRow.price_cents, pRow.currency]
      );
    }
    res.status(201).json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

app.put('/api/cart', async (req, res) => {
  try {
    const { product_id, variant_id = null, quantity } = req.body || {};
    if (!product_id) return res.status(400).json({ error: 'product_id requerido' });
    const q = Math.max(0, Number(quantity || 0));
    const pool = getPool();
    const { cartId } = await getOrCreateCart(req, res);
    if (q === 0) {
      await pool.query('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ? AND IFNULL(variant_id,0) = IFNULL(?,0)', [cartId, product_id, variant_id]);
      return res.json({ ok: true, removed: true });
    }
    await pool.query('UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ? AND IFNULL(variant_id,0) = IFNULL(?,0)', [q, cartId, product_id, variant_id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

app.delete('/api/cart', async (req, res) => {
  try {
    const { product_id, variant_id = null } = req.body || {};
    if (!product_id) return res.status(400).json({ error: 'product_id requerido' });
    const pool = getPool();
    const { cartId } = await getOrCreateCart(req, res);
    await pool.query('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ? AND IFNULL(variant_id,0) = IFNULL(?,0)', [cartId, product_id, variant_id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

// -------- Checkout desde carrito --------
app.post('/api/checkout', async (req, res) => {
  const pool = getPool();
  let conn;
  try {
  const { name, email, address, city, phone, coupon_code = null } = req.body || {};
    if (!name || !email || !address || !city || !phone) return res.status(400).json({ error: 'faltan datos de envío' });
    const { cartId } = await getOrCreateCart(req, res);
    const [items] = await pool.query(
      `SELECT ci.product_id, ci.variant_id, ci.quantity FROM cart_items ci WHERE ci.cart_id = ?`, [cartId]);
    if (!items.length) return res.status(400).json({ error: 'carrito vacío' });

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Resolve products and compute totals (similar a /api/shop/orders)
    let currency = null;
    let subtotal = 0;
    const resolved = [];
    for (const it of items) {
      const [r] = await conn.query('SELECT id, name, slug, price_cents, currency, stock, active, sku FROM products WHERE id = ? LIMIT 1', [it.product_id]);
      const p = r[0];
      if (!p) throw new Error('producto no encontrado');
      if (p.active !== 1) throw new Error('producto inactivo');
      let unitPrice = p.price_cents;
      let variantRow = null;
      if (it.variant_id) {
        const [vr] = await conn.query('SELECT id, product_id, sku, name, size, color, price_cents, stock FROM product_variants WHERE id = ? AND product_id = ? LIMIT 1', [it.variant_id, p.id]);
        variantRow = vr[0] || null;
        if (!variantRow) throw new Error('variant inválida');
        if (variantRow.price_cents != null) unitPrice = variantRow.price_cents;
      }
      if (!currency) currency = p.currency;
      if (currency !== p.currency) throw new Error('mezcla de monedas no soportada');
      const qty = Math.max(1, Math.min(Number(it.quantity || 1), 99));
      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;
      resolved.push({ product: p, variant: variantRow, unitPrice, quantity: qty });
    }
    // Cupón opcional
    let couponId = null;
    let discount = 0;
    if (coupon_code) {
      const [cr] = await conn.query(
        `SELECT id, type, percent_off, amount_off_cents, currency, starts_at, ends_at, active, max_redemptions, usage_count
           FROM coupons WHERE code = ? LIMIT 1`,
        [coupon_code]
      );
      const c = cr[0];
      const now = new Date();
      const within = c && (!c.starts_at || new Date(c.starts_at) <= now) && (!c.ends_at || new Date(c.ends_at) >= now);
      const active = c && c.active === 1;
      const left = c && (c.max_redemptions == null || c.usage_count < c.max_redemptions);
      const sameCur = c && (!c.currency || c.currency === currency);
      if (!c || !within || !active || !left || !sameCur) {
        throw new Error('cupón inválido');
      }
      couponId = c.id;
      if (c.type === 'percent' && c.percent_off) {
        discount = Math.floor(subtotal * (c.percent_off / 100));
      } else if (c.type === 'fixed' && c.amount_off_cents) {
        discount = Math.min(subtotal, c.amount_off_cents);
      }
    }
    const shipping = 0, tax = 0;
    const total = Math.max(0, subtotal - discount + shipping + tax);

    // create addresses
    const [addrIns] = await conn.query(
      `INSERT INTO addresses (full_name, line1, city, country_code, phone) VALUES (?, ?, ?, 'CO', ?)`,
      [name, address, city, phone]
    );
    const addrId = addrIns.insertId;

  // Create order
    let orderNumber;
    for (let i = 0; i < 5; i++) {
      orderNumber = 'PF' + Date.now() + '-' + randomId(4);
      try {
        await conn.query(
          `INSERT INTO orders (order_number, user_id, email, phone, billing_address_id, shipping_address_id, status, currency,
                subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents, coupon_id, notes)
       VALUES (?, NULL, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [orderNumber, email, phone, addrId, addrId, currency, subtotal, discount, shipping, tax, total, couponId]
        );
        break;
      } catch (e) { if (!e || e.code !== 'ER_DUP_ENTRY') throw e; }
    }

    const [orows] = await conn.query('SELECT id FROM orders WHERE order_number = ? LIMIT 1', [orderNumber]);
    const orderId = orows[0]?.id; if (!orderId) throw new Error('no se pudo crear la orden');

    // items
    for (const r of resolved) {
      const nameLine = r.product.name + (r.variant?.name ? (' - ' + r.variant.name) : '');
      const sku = r.variant?.sku || r.product.sku || null;
      const total_cents = r.unitPrice * r.quantity;
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, variant_id, name, sku, unit_price_cents, quantity, total_cents)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, r.product.id, r.variant?.id || null, nameLine, sku, r.unitPrice, r.quantity, total_cents]
      );
    }

  await conn.query(`INSERT INTO payments (order_id, provider, status, amount_cents, currency) VALUES (?, 'manual', 'pending', ?, ?)`, [orderId, total, currency]);

    // clear cart
    await conn.query('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);

    await conn.commit();
    res.status(201).json({ order_id: orderId });
  } catch (err) {
    try { if (conn) await conn.rollback(); } catch(_){}
  const msg = err?.message || 'internal server error';
  const code = ['producto no encontrado','variant inválida','producto inactivo','mezcla de monedas no soportada','carrito vacío','cupón inválido'].includes(msg) ? 400 : 500;
    res.status(code).json({ error: msg });
  } finally { if (conn) conn.release(); }
});

// -------- Payment endpoints para UI de pago --------
app.get('/api/payment/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const pool = getPool();
    const [orows] = await pool.query(
      `SELECT o.id, o.order_number, o.email, o.phone, o.total_cents, o.currency, o.status,
              a.full_name AS name, a.line1 AS address, a.city
         FROM orders o
         LEFT JOIN addresses a ON a.id = o.shipping_address_id
        WHERE o.id = ? LIMIT 1`, [orderId]);
    if (!orows.length) return res.status(404).json({ error: 'orden no encontrada' });
    res.json({ order: orows[0] });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

// Consulta pública de orden por número
app.get('/api/orders/lookup', async (req, res) => {
  try {
    const { number, email } = req.query || {};
    if (!number) return res.status(400).json({ error: 'falta number' });
    const pool = getPool();
    const params = [number];
    let whereEmail = '';
    if (email) { whereEmail = ' AND (o.email = ? OR ? IS NULL)'; params.push(email, email); }
    const [rows] = await pool.query(
      `SELECT o.id, o.order_number, o.email, o.phone, o.total_cents, o.currency, o.status,
              a.full_name AS name, a.line1 AS address, a.city,
              DATE_FORMAT(o.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
         FROM orders o
         LEFT JOIN addresses a ON a.id = o.shipping_address_id
        WHERE o.order_number = ? ${whereEmail}
        LIMIT 1`, params);
    if (!rows.length) return res.status(404).json({ error: 'orden no encontrada' });
    const [items] = await pool.query(
      `SELECT name, sku, unit_price_cents, quantity, total_cents FROM order_items WHERE order_id = ? ORDER BY id ASC`,
      [rows[0].id]
    );
    res.json({ order: rows[0], items });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

app.post('/api/payment/:orderId', async (req, res) => {
  const pool = getPool();
  let conn;
  try {
    const { orderId } = req.params;
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [orows] = await conn.query('SELECT id, status, coupon_id FROM orders WHERE id = ? LIMIT 1', [orderId]);
    if (!orows.length) return res.status(404).json({ error: 'orden no encontrada' });
    const order = orows[0];
    if (order.status !== 'pending') return res.status(400).json({ error: 'orden no pendiente' });
    const [items] = await conn.query('SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?', [orderId]);
    // check stock
    for (const it of items) {
      if (it.variant_id) {
        const [vr] = await conn.query('SELECT stock FROM product_variants WHERE id = ? LIMIT 1', [it.variant_id]);
        const st = vr[0]?.stock ?? 0; if (st < it.quantity) throw new Error('stock insuficiente');
      } else if (it.product_id) {
        const [pr] = await conn.query('SELECT stock FROM products WHERE id = ? LIMIT 1', [it.product_id]);
        const st = pr[0]?.stock ?? 0; if (st < it.quantity) throw new Error('stock insuficiente');
      }
    }
    // decrement
    for (const it of items) {
      if (it.variant_id) {
        await conn.query('UPDATE product_variants SET stock = stock - ? WHERE id = ?', [it.quantity, it.variant_id]);
        await conn.query('INSERT INTO inventory_movements (variant_id, change_qty, reason, reference) VALUES (?, ?, \'order\', ?)', [it.variant_id, -it.quantity, String(orderId)]);
      } else if (it.product_id) {
        await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [it.quantity, it.product_id]);
        await conn.query('INSERT INTO inventory_movements (product_id, change_qty, reason, reference) VALUES (?, ?, \'order\', ?)', [it.product_id, -it.quantity, String(orderId)]);
      }
    }
    await conn.query("UPDATE payments SET status = 'succeeded', updated_at = NOW() WHERE order_id = ?", [orderId]);
    await conn.query("UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = ?", [orderId]);
    if (order.coupon_id) await conn.query('UPDATE coupons SET usage_count = usage_count + 1 WHERE id = ?', [order.coupon_id]);
    await conn.commit();
    res.json({ ok: true, order_id: Number(orderId), status: 'paid' });
  } catch (err) {
    try { if (conn) await conn.rollback(); } catch(_){}
    const msg = err?.message || 'internal server error';
    const code = (msg === 'stock insuficiente') ? 400 : 500;
    res.status(code).json({ error: msg });
  } finally { if (conn) conn.release(); }
});

// -------- API Blog --------
// Helper to check admin
async function isAdminUser(userId) {
  try {
    if (!userId) return false;
    const pool = getPool();
    const [rows] = await pool.query('SELECT is_admin FROM users WHERE id = ? LIMIT 1', [userId]);
    return !!(rows.length && rows[0].is_admin === 1);
  } catch (_) { return false; }
}
// Listar posts (públicos por defecto, soporta q y status)
app.get('/api/blog/posts', async (req, res) => {
  try {
    const pool = getPool();
    const { q = '', status = 'published' } = req.query || {};
    const params = [];
    let where = 'WHERE 1=1';
    if (status) { where += ' AND bp.status = ?'; params.push(status); }
    if (q) { where += ' AND (bp.title LIKE ? OR bp.excerpt LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
    const [rows] = await pool.query(
      `SELECT bp.id, bp.title, bp.slug, bp.excerpt, bp.cover_image_url, bp.published_at,
              u.name AS author_name,
              COALESCE(SUM(CASE WHEN bpr.reaction='up' THEN 1 ELSE 0 END),0) AS up_count,
              COALESCE(SUM(CASE WHEN bpr.reaction='down' THEN 1 ELSE 0 END),0) AS down_count,
              (SELECT COUNT(1) FROM blog_comments bc WHERE bc.post_id = bp.id AND bc.status = 'visible') AS comment_count,
              (SELECT GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ',')
                 FROM blog_post_categories pc JOIN blog_categories c ON c.id = pc.category_id
                WHERE pc.post_id = bp.id) AS categories_csv,
              (SELECT GROUP_CONCAT(DISTINCT t.name ORDER BY t.name SEPARATOR ',')
                 FROM blog_post_tags pt JOIN blog_tags t ON t.id = pt.tag_id
                WHERE pt.post_id = bp.id) AS tags_csv
         FROM blog_posts bp
         LEFT JOIN users u ON u.id = bp.author_id
         LEFT JOIN blog_post_reactions bpr ON bpr.post_id = bp.id
         ${where}
         GROUP BY bp.id
         ORDER BY COALESCE(bp.published_at, bp.created_at) DESC
         LIMIT 100`, params);
    const posts = rows.map(r => ({
      ...r,
      categories: r.categories_csv ? String(r.categories_csv).split(',').filter(Boolean) : [],
      tags: r.tags_csv ? String(r.tags_csv).split(',').filter(Boolean) : []
    }));
    res.json({ posts });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

// Crear post (requiere auth)
app.post('/api/blog/posts', requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.sub;
    const { title, slug, content, excerpt = null, cover_image_url = null, status = 'draft' } = req.body || {};
    if (!title || !content) return res.status(400).json({ error: 'title y content son obligatorios' });
    const pool = getPool();
    const [r] = await pool.query(
      `INSERT INTO blog_posts (author_id, title, slug, excerpt, content, cover_image_url, status, published_at)
       VALUES (?, ?, COALESCE(?, REPLACE(LOWER(?), ' ', '-')), ?, ?, ?, ?, CASE WHEN ?='published' THEN NOW() ELSE NULL END)`,
      [userId, title, slug || null, title, excerpt, content, cover_image_url, status, status]
    );
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'slug ya existe' });
    res.status(500).json({ error: 'internal server error' });
  }
});

// Obtener post por slug (público)
app.get('/api/blog/posts/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT bp.*, u.name AS author_name,
              (SELECT GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ',')
                 FROM blog_post_categories pc JOIN blog_categories c ON c.id = pc.category_id
                WHERE pc.post_id = bp.id) AS categories_csv,
              (SELECT GROUP_CONCAT(DISTINCT t.name ORDER BY t.name SEPARATOR ',')
                 FROM blog_post_tags pt JOIN blog_tags t ON t.id = pt.tag_id
                WHERE pt.post_id = bp.id) AS tags_csv
         FROM blog_posts bp
         LEFT JOIN users u ON u.id = bp.author_id
        WHERE bp.slug = ?
        LIMIT 1`,
      [slug]
    );
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    const post = rows[0];
    // Only published visible unless author/admin
    let isOwnerOrAdmin = false;
    try {
      const auth = req.headers.authorization || '';
      const m = auth.match(/^Bearer\s+(.+)$/i);
      if (m) {
        const payload = jwt.verify(m[1], config.jwtSecret);
        if (payload?.sub && Number(payload.sub) === Number(post.author_id)) isOwnerOrAdmin = true;
        if (await isAdminUser(payload?.sub)) isOwnerOrAdmin = true;
      }
    } catch(_){}
    if (post.status !== 'published' && !isOwnerOrAdmin) return res.status(403).json({ error: 'forbidden' });
  const [re] = await pool.query(
      `SELECT SUM(CASE WHEN reaction='up' THEN 1 ELSE 0 END) AS up_count,
              SUM(CASE WHEN reaction='down' THEN 1 ELSE 0 END) AS down_count
         FROM blog_post_reactions WHERE post_id = ?`,
      [post.id]
    );
    post.up_count = re[0]?.up_count || 0;
    post.down_count = re[0]?.down_count || 0;
    post.can_edit = isOwnerOrAdmin;
  post.categories = rows[0]?.categories_csv ? String(rows[0].categories_csv).split(',').filter(Boolean) : [];
  post.tags = rows[0]?.tags_csv ? String(rows[0].tags_csv).split(',').filter(Boolean) : [];
    res.json({ post });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

// Obtener post por id (para editor)
app.get('/api/blog/posts/id/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.auth?.sub;
    const pool = getPool();
    const [rows] = await pool.query(`SELECT * FROM blog_posts WHERE id = ? LIMIT 1`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'not found' });
  const isAdmin = await isAdminUser(userId);
  if (rows[0].author_id !== Number(userId) && !isAdmin) return res.status(403).json({ error: 'forbidden' });
    res.json({ post: rows[0] });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

// Actualizar post
app.put('/api/blog/posts/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.auth?.sub;
    const { title, slug, content, excerpt, cover_image_url, status } = req.body || {};
    const pool = getPool();
    const [rows] = await pool.query('SELECT author_id FROM blog_posts WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    if (rows[0].author_id !== Number(userId) && !req.auth?.is_admin) return res.status(403).json({ error: 'forbidden' });
    await pool.query(
      `UPDATE blog_posts SET
         title = COALESCE(?, title),
         slug = COALESCE(?, slug),
         content = COALESCE(?, content),
         excerpt = COALESCE(?, excerpt),
         cover_image_url = COALESCE(?, cover_image_url),
         status = COALESCE(?, status),
         published_at = CASE WHEN ?='published' THEN COALESCE(published_at, NOW()) ELSE published_at END,
         updated_at = NOW()
       WHERE id = ?`,
      [title ?? null, slug ?? null, content ?? null, excerpt ?? null, cover_image_url ?? null, status ?? null, status ?? '', id]
    );
    res.json({ ok: true });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'slug ya existe' });
    res.status(500).json({ error: 'internal server error' });
  }
});

// Comentar post (raíz)
app.post('/api/blog/posts/:slug/comments', requireAuth, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.auth?.sub;
    const { body, parent_id = null } = req.body || {};
    if (!body) return res.status(400).json({ error: 'body es requerido' });
    const pool = getPool();
    const [p] = await pool.query('SELECT id FROM blog_posts WHERE slug = ? LIMIT 1', [slug]);
    if (!p.length) return res.status(404).json({ error: 'post not found' });
    if (parent_id) {
      const [pc] = await pool.query('SELECT id FROM blog_comments WHERE id = ? AND post_id = ? LIMIT 1', [parent_id, p[0].id]);
      if (!pc.length) return res.status(400).json({ error: 'parent invalido' });
    }
    const [r] = await pool.query('INSERT INTO blog_comments (post_id, user_id, parent_id, body, status) VALUES (?, ?, ?, ?, "visible")', [p[0].id, userId, parent_id || null, body]);
    res.status(201).json({ id: r.insertId });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

// Listar comentarios en forma de árbol
app.get('/api/blog/posts/:slug/comments', async (req, res) => {
  try {
    const { slug } = req.params;
    const pool = getPool();
    const [p] = await pool.query('SELECT id FROM blog_posts WHERE slug = ? LIMIT 1', [slug]);
    if (!p.length) return res.status(404).json({ error: 'post not found' });
    const [rows] = await pool.query(
      `SELECT bc.*, u.name AS user_name,
              COALESCE((SELECT COUNT(1) FROM blog_comment_reactions r WHERE r.comment_id = bc.id AND r.reaction='up'),0) AS up_count,
              COALESCE((SELECT COUNT(1) FROM blog_comment_reactions r WHERE r.comment_id = bc.id AND r.reaction='down'),0) AS down_count
         FROM blog_comments bc
         LEFT JOIN users u ON u.id = bc.user_id
        WHERE bc.post_id = ? AND bc.status IN ('visible','pending')
        ORDER BY bc.created_at ASC`, [p[0].id]);
    // Build tree
    const byId = new Map();
    rows.forEach(r => byId.set(r.id, { ...r, children: [] }));
    const roots = [];
    byId.forEach(n => {
      if (n.parent_id && byId.has(n.parent_id)) byId.get(n.parent_id).children.push(n); else roots.push(n);
    });
    res.json({ comments: roots });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

// Reacciones a post (toggle up/down)
app.post('/api/blog/posts/:slug/react', requireAuth, async (req, res) => {
  try {
    const { slug } = req.params;
    const { reaction } = req.body || {};
    if (!['up','down'].includes(reaction)) return res.status(400).json({ error: 'reaction invalida' });
    const userId = req.auth?.sub;
    const pool = getPool();
    const [p] = await pool.query('SELECT id FROM blog_posts WHERE slug = ? LIMIT 1', [slug]);
    if (!p.length) return res.status(404).json({ error: 'post not found' });
    // Toggle: if same reaction exists, remove; else upsert
    const [ex] = await pool.query('SELECT id, reaction FROM blog_post_reactions WHERE post_id = ? AND user_id = ? LIMIT 1', [p[0].id, userId]);
    if (ex.length && ex[0].reaction === reaction) {
      await pool.query('DELETE FROM blog_post_reactions WHERE id = ?', [ex[0].id]);
      return res.json({ ok: true, removed: true });
    } else {
      await pool.query('INSERT INTO blog_post_reactions (post_id, user_id, reaction) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE reaction = VALUES(reaction)', [p[0].id, userId, reaction]);
      return res.json({ ok: true, reaction });
    }
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

// Reaccionar a comment
app.post('/api/blog/comments/:id/react', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reaction } = req.body || {};
    if (!['up','down'].includes(reaction)) return res.status(400).json({ error: 'reaction invalida' });
    const userId = req.auth?.sub;
    const pool = getPool();
    const [c] = await pool.query('SELECT id FROM blog_comments WHERE id = ? LIMIT 1', [id]);
    if (!c.length) return res.status(404).json({ error: 'comment not found' });
    const [ex] = await pool.query('SELECT id, reaction FROM blog_comment_reactions WHERE comment_id = ? AND user_id = ? LIMIT 1', [id, userId]);
    if (ex.length && ex[0].reaction === reaction) {
      await pool.query('DELETE FROM blog_comment_reactions WHERE id = ?', [ex[0].id]);
      return res.json({ ok: true, removed: true });
    } else {
      await pool.query('INSERT INTO blog_comment_reactions (comment_id, user_id, reaction) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE reaction = VALUES(reaction)', [id, userId, reaction]);
      return res.json({ ok: true, reaction });
    }
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

// Counters for a post (and user's own reaction if auth)
app.get('/api/blog/posts/:slug/reactions', async (req, res) => {
  try {
    const { slug } = req.params;
    const pool = getPool();
    const [p] = await pool.query('SELECT id FROM blog_posts WHERE slug = ? LIMIT 1', [slug]);
    if (!p.length) return res.status(404).json({ error: 'post not found' });
    const postId = p[0].id;
    const [rows] = await pool.query(
      `SELECT 
         SUM(CASE WHEN reaction='up' THEN 1 ELSE 0 END) AS up_count,
         SUM(CASE WHEN reaction='down' THEN 1 ELSE 0 END) AS down_count
       FROM blog_post_reactions WHERE post_id = ?`, [postId]);
    const up = rows[0]?.up_count || 0;
    const down = rows[0]?.down_count || 0;
    let mine = null;
    try {
      const auth = req.headers.authorization || '';
      const m = auth.match(/^Bearer\s+(.+)$/i);
      if (m) {
        const payload = jwt.verify(m[1], config.jwtSecret);
        const [mr] = await pool.query('SELECT reaction FROM blog_post_reactions WHERE post_id = ? AND user_id = ? LIMIT 1', [postId, payload?.sub]);
        mine = mr[0]?.reaction || null;
      }
    } catch(_){}
    return res.json({ up, down, score: (up - down), mine });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

// Counters for a comment (and user's own reaction if auth)
app.get('/api/blog/comments/:id/reactions', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const [exists] = await pool.query('SELECT id FROM blog_comments WHERE id = ? LIMIT 1', [id]);
    if (!exists.length) return res.status(404).json({ error: 'comment not found' });
    const [rows] = await pool.query(
      `SELECT 
         SUM(CASE WHEN reaction='up' THEN 1 ELSE 0 END) AS up_count,
         SUM(CASE WHEN reaction='down' THEN 1 ELSE 0 END) AS down_count
       FROM blog_comment_reactions WHERE comment_id = ?`, [id]);
    const up = rows[0]?.up_count || 0;
    const down = rows[0]?.down_count || 0;
    let mine = null;
    try {
      const auth = req.headers.authorization || '';
      const m = auth.match(/^Bearer\s+(.+)$/i);
      if (m) {
        const payload = jwt.verify(m[1], config.jwtSecret);
        const [mr] = await pool.query('SELECT reaction FROM blog_comment_reactions WHERE comment_id = ? AND user_id = ? LIMIT 1', [id, payload?.sub]);
        mine = mr[0]?.reaction || null;
      }
    } catch(_){}
    return res.json({ up, down, score: (up - down), mine });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

// -------- Admin Blog: Moderación de comentarios --------
// Listar comentarios con filtros (status, q, post_id)
app.get('/api/admin/blog/comments', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status = '', q = '', post_id = '' } = req.query || {};
    const params = [];
    let where = 'WHERE 1=1';
    if (status) { where += ' AND bc.status = ?'; params.push(status); }
    if (post_id) { where += ' AND bc.post_id = ?'; params.push(Number(post_id)); }
    if (q) { where += ' AND (bc.body LIKE ? OR bp.title LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT bc.id, bc.post_id, bc.user_id, bc.parent_id, bc.body, bc.status, bc.created_at, bc.updated_at,
              u.name AS user_name, bp.title AS post_title, bp.slug AS post_slug
         FROM blog_comments bc
         LEFT JOIN users u ON u.id = bc.user_id
         JOIN blog_posts bp ON bp.id = bc.post_id
        ${where}
        ORDER BY bc.created_at DESC
        LIMIT 200`, params);
    res.json({ comments: rows });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

// Cambiar estado de un comentario
app.patch('/api/admin/blog/comments/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const allowed = ['visible','pending','hidden','deleted'];
    if (status && !allowed.includes(String(status))) return res.status(400).json({ error: 'status invalido' });
    const pool = getPool();
    const [ex] = await pool.query('SELECT id FROM blog_comments WHERE id = ? LIMIT 1', [id]);
    if (!ex.length) return res.status(404).json({ error: 'comment not found' });
    await pool.query('UPDATE blog_comments SET status = COALESCE(?, status), updated_at = NOW() WHERE id = ?', [status ?? null, id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

// Eliminar comentario
app.delete('/api/admin/blog/comments/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    await pool.query('DELETE FROM blog_comments WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

// -------- Admin Blog: Categorías --------
app.get('/api/admin/blog/categories', requireAuth, requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT id, name, slug, description, created_at FROM blog_categories ORDER BY created_at DESC');
    res.json({ categories: rows });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});
app.post('/api/admin/blog/categories', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, slug, description = null } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name requerido' });
    const pool = getPool();
    const [r] = await pool.query('INSERT INTO blog_categories (name, slug, description) VALUES (?, COALESCE(?, REPLACE(LOWER(?), " ", "-")), ?)', [name, slug || null, name, description]);
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'slug ya existe' });
    res.status(500).json({ error: 'internal server error' });
  }
});
app.put('/api/admin/blog/categories/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description } = req.body || {};
    const pool = getPool();
    await pool.query('UPDATE blog_categories SET name = COALESCE(?, name), slug = COALESCE(?, slug), description = COALESCE(?, description) WHERE id = ?', [name ?? null, slug ?? null, description ?? null, id]);
    res.json({ ok: true });
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'slug ya existe' });
    res.status(500).json({ error: 'internal server error' });
  }
});
app.delete('/api/admin/blog/categories/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    await pool.query('DELETE FROM blog_post_categories WHERE category_id = ?', [id]);
    await pool.query('DELETE FROM blog_categories WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

// -------- Admin Blog: Tags --------
app.get('/api/admin/blog/tags', requireAuth, requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT id, name, slug, created_at FROM blog_tags ORDER BY created_at DESC');
    res.json({ tags: rows });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});
app.post('/api/admin/blog/tags', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, slug } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name requerido' });
    const pool = getPool();
    const [r] = await pool.query('INSERT INTO blog_tags (name, slug) VALUES (?, COALESCE(?, REPLACE(LOWER(?), " ", "-")))', [name, slug || null, name]);
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'slug ya existe' });
    res.status(500).json({ error: 'internal server error' });
  }
});
app.put('/api/admin/blog/tags/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug } = req.body || {};
    const pool = getPool();
    await pool.query('UPDATE blog_tags SET name = COALESCE(?, name), slug = COALESCE(?, slug) WHERE id = ?', [name ?? null, slug ?? null, id]);
    res.json({ ok: true });
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'slug ya existe' });
    res.status(500).json({ error: 'internal server error' });
  }
});
app.delete('/api/admin/blog/tags/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    await pool.query('DELETE FROM blog_post_tags WHERE tag_id = ?', [id]);
    await pool.query('DELETE FROM blog_tags WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'internal server error' }); }
});

// -------- Checkout (crear orden) --------
app.post('/api/shop/orders', async (req, res) => {
  const pool = getPool();
  let conn;
  try {
    const {
      items, // [{ product_id or slug, variant_id?, quantity }]
      email,
      phone,
      shipping_address = {},
      billing_address = null,
      coupon_code = null,
      payment_provider = 'manual'
    } = req.body || {};
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items es requerido' });
    if (!email && !req.headers.authorization) return res.status(400).json({ error: 'email es requerido (o usa token)' });

    // Optional: detect user from Authorization header
    let userId = null;
    try {
      const auth = req.headers.authorization || '';
      const m = auth.match(/^Bearer\s+(.+)$/i);
      if (m) {
        const payload = jwt.verify(m[1], config.jwtSecret);
        userId = payload.sub || null;
      }
    } catch (_) {}

    // Normalize and validate items
    const normItems = [];
    for (const raw of items) {
      const quantity = Number(raw?.quantity || 0);
      if (!quantity || quantity <= 0) return res.status(400).json({ error: 'quantity inválida' });
      normItems.push({
        product_id: raw.product_id || null,
        slug: raw.slug || null,
        variant_id: raw.variant_id || null,
        quantity
      });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Resolve products/variants and compute prices
    let currency = null;
    let subtotal = 0;
    const resolved = [];
    for (const it of normItems) {
      let productRow = null;
      if (it.product_id) {
        const [r] = await conn.query('SELECT id, name, slug, price_cents, currency, stock, active, sku FROM products WHERE id = ? LIMIT 1', [it.product_id]);
        productRow = r[0];
      } else if (it.slug) {
        const [r] = await conn.query('SELECT id, name, slug, price_cents, currency, stock, active, sku FROM products WHERE slug = ? LIMIT 1', [it.slug]);
        productRow = r[0];
      }
      if (!productRow) throw new Error('producto no encontrado');
      if (!productRow.active) throw new Error('producto inactivo');
      let unitPrice = productRow.price_cents;
      let variantRow = null;
      if (it.variant_id) {
        const [vr] = await conn.query('SELECT id, product_id, sku, name, size, color, price_cents, stock FROM product_variants WHERE id = ? AND product_id = ? LIMIT 1', [it.variant_id, productRow.id]);
        variantRow = vr[0] || null;
        if (!variantRow) throw new Error('variant inválida');
        if (variantRow.price_cents != null) unitPrice = variantRow.price_cents;
      }
      if (!currency) currency = productRow.currency;
      if (currency !== productRow.currency) throw new Error('mezcla de monedas no soportada');
      const lineTotal = unitPrice * it.quantity;
      subtotal += lineTotal;
      resolved.push({ product: productRow, variant: variantRow, unitPrice, quantity: it.quantity });
    }

    // Coupon (optional)
    let couponId = null;
    let discount = 0;
    if (coupon_code) {
      const [cr] = await conn.query(
        `SELECT id, type, percent_off, amount_off_cents, currency, starts_at, ends_at, active, max_redemptions, usage_count
           FROM coupons WHERE code = ? LIMIT 1`,
        [coupon_code]
      );
      const c = cr[0];
      const now = new Date();
      const within = c && (!c.starts_at || new Date(c.starts_at) <= now) && (!c.ends_at || new Date(c.ends_at) >= now);
      const active = c && c.active === 1;
      const left = c && (c.max_redemptions == null || c.usage_count < c.max_redemptions);
      const sameCur = c && (!c.currency || c.currency === currency);
      if (!c || !within || !active || !left || !sameCur) {
        throw new Error('cupón inválido');
      }
      couponId = c.id;
      if (c.type === 'percent' && c.percent_off) {
        discount = Math.floor(subtotal * (c.percent_off / 100));
      } else if (c.type === 'fixed' && c.amount_off_cents) {
        discount = Math.min(subtotal, c.amount_off_cents);
      }
    }

    // Shipping & tax placeholders
    const shipping = 0;
    const tax = 0;
    const total = Math.max(0, subtotal - discount + shipping + tax);

    // Addresses
    async function insertAddress(addr) {
      if (!addr) return null;
      const {
        full_name, line1, line2 = null, city, region = null, postal_code = null, country_code = 'CO', phone: addrPhone = null
      } = addr;
      if (!full_name || !line1 || !city) return null;
      const [ar] = await conn.query(
        `INSERT INTO addresses (user_id, full_name, line1, line2, city, region, postal_code, country_code, phone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId || null, full_name, line1, line2, city, region, postal_code, country_code, addrPhone]
      );
      return ar.insertId;
    }
    const shippingAddressId = await insertAddress(shipping_address);
    const billingAddressId = billing_address ? (await insertAddress(billing_address)) : shippingAddressId;

    // Create order shell
    let orderNumber;
    for (let i = 0; i < 5; i++) {
      orderNumber = 'PF' + Date.now() + '-' + randomId(4);
      try {
        await conn.query(
          `INSERT INTO orders (order_number, user_id, email, phone, billing_address_id, shipping_address_id, status, currency,
                                subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents, coupon_id, notes)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, NULL)`,
          [orderNumber, userId || null, email || null, phone || null, billingAddressId || null, shippingAddressId || null, currency,
           subtotal, discount, shipping, tax, total, couponId]
        );
        break;
      } catch (e) {
        if (!e || e.code !== 'ER_DUP_ENTRY') throw e;
      }
    }

    // Fetch order id
    const [orderRows] = await conn.query('SELECT id FROM orders WHERE order_number = ? LIMIT 1', [orderNumber]);
    const orderId = orderRows[0]?.id;
    if (!orderId) throw new Error('no se pudo crear la orden');

    // Insert items
    for (const r of resolved) {
      const name = r.product.name + (r.variant?.name ? (' - ' + r.variant.name) : '');
      const sku = r.variant?.sku || r.product.sku || null;
      const total_cents = r.unitPrice * r.quantity;
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, variant_id, name, sku, unit_price_cents, quantity, total_cents)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, r.product.id, r.variant?.id || null, name, sku, r.unitPrice, r.quantity, total_cents]
      );
    }

    // Create payment (pending)
    const [pr] = await conn.query(
      `INSERT INTO payments (order_id, provider, status, amount_cents, currency)
       VALUES (?, ?, 'pending', ?, ?)`,
      [orderId, payment_provider || 'manual', total, currency]
    );

    await conn.commit();
    res.status(201).json({ order_id: orderId, order_number: orderNumber, status: 'pending', payment_id: pr.insertId, currency, total_cents: total });
  } catch (err) {
    try { if (conn) await conn.rollback(); } catch(_){}
    const msg = (err && err.message) || 'internal server error';
    if (msg === 'producto no encontrado' || msg === 'variant inválida' || msg === 'producto inactivo' || msg === 'mezcla de monedas no soportada' || msg === 'cupón inválido') {
      return res.status(400).json({ error: msg });
    }
    res.status(500).json({ error: 'internal server error', detail: msg });
  } finally {
    if (conn) conn.release();
  }
});

// -------- Simular pago (DEV): cambia estado y descuenta stock --------
app.post('/api/shop/payments/simulate', async (req, res) => {
  if (config.env === 'production') return res.status(403).json({ error: 'no disponible en producción' });
  const pool = getPool();
  let conn;
  try {
    const { order_id, payment_id, outcome = 'succeeded' } = req.body || {};
    if (!order_id && !payment_id) return res.status(400).json({ error: 'order_id o payment_id requerido' });
    conn = await pool.getConnection();
    await conn.beginTransaction();
    // Resolve order & payment
    let orderId = order_id;
    if (!orderId && payment_id) {
      const [pr] = await conn.query('SELECT order_id FROM payments WHERE id = ? LIMIT 1', [payment_id]);
      if (!pr.length) throw new Error('payment no encontrado');
      orderId = pr[0].order_id;
    }
    const [orows] = await conn.query('SELECT id, status, total_cents, currency, coupon_id FROM orders WHERE id = ? LIMIT 1', [orderId]);
    if (!orows.length) throw new Error('orden no encontrada');
    const order = orows[0];
    if (order.status !== 'pending') throw new Error('orden no pendiente');
    const [items] = await conn.query('SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?', [orderId]);

    if (outcome === 'succeeded') {
      // check stock then decrement
      for (const it of items) {
        if (it.variant_id) {
          const [vr] = await conn.query('SELECT stock FROM product_variants WHERE id = ? LIMIT 1', [it.variant_id]);
          const st = vr[0]?.stock ?? 0;
          if (st < it.quantity) throw new Error('stock insuficiente');
        } else if (it.product_id) {
          const [pr] = await conn.query('SELECT stock FROM products WHERE id = ? LIMIT 1', [it.product_id]);
          const st = pr[0]?.stock ?? 0;
          if (st < it.quantity) throw new Error('stock insuficiente');
        }
      }
      // decrement
      for (const it of items) {
        if (it.variant_id) {
          await conn.query('UPDATE product_variants SET stock = stock - ? WHERE id = ?', [it.quantity, it.variant_id]);
          await conn.query('INSERT INTO inventory_movements (variant_id, change_qty, reason, reference) VALUES (?, ?, \'order\', ?)', [it.variant_id, -it.quantity, String(orderId)]);
        } else if (it.product_id) {
          await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [it.quantity, it.product_id]);
          await conn.query('INSERT INTO inventory_movements (product_id, change_qty, reason, reference) VALUES (?, ?, \'order\', ?)', [it.product_id, -it.quantity, String(orderId)]);
        }
      }
      // mark payment and order
      if (payment_id) await conn.query("UPDATE payments SET status = 'succeeded', updated_at = NOW() WHERE id = ?", [payment_id]);
      else await conn.query("UPDATE payments SET status = 'succeeded', updated_at = NOW() WHERE order_id = ?", [orderId]);
      await conn.query("UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = ?", [orderId]);
      // increment coupon usage if any
      if (order.coupon_id) await conn.query('UPDATE coupons SET usage_count = usage_count + 1 WHERE id = ?', [order.coupon_id]);
      await conn.commit();
      return res.json({ ok: true, order_id: orderId, status: 'paid' });
    } else {
      // failure
      if (payment_id) await conn.query("UPDATE payments SET status = 'failed', updated_at = NOW() WHERE id = ?", [payment_id]);
      else await conn.query("UPDATE payments SET status = 'failed', updated_at = NOW() WHERE order_id = ?", [orderId]);
      await conn.query("UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = ?", [orderId]);
      await conn.commit();
      return res.json({ ok: true, order_id: orderId, status: 'cancelled' });
    }
  } catch (err) {
    try { if (conn) await conn.rollback(); } catch(_){}
    const msg = err?.message || 'internal error';
    const code = (msg === 'orden no encontrada' || msg === 'orden no pendiente' || msg === 'payment no encontrado' || msg === 'stock insuficiente') ? 400 : 500;
    return res.status(code).json({ error: msg });
  } finally {
    if (conn) conn.release();
  }
});

// NFC short route: /n/:nfcId -> redirects to /p/:qrId
app.get('/n/:nfcId', async (req, res) => {
  try {
    const { nfcId } = req.params;
    if (!nfcId) return res.status(400).send('bad request');
    const pool = getPool();
    const [rows] = await pool.query('SELECT qr_id FROM pets WHERE nfc_id = ? LIMIT 1', [nfcId]);
    if (!rows.length) return res.status(404).send('not found');
    const url = '/p/' + rows[0].qr_id;
    res.redirect(302, url);
  } catch (err) {
    res.status(500).send('internal error');
  }
});

// Raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

module.exports = app;
