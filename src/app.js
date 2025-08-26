const express = require('express');
const path = require('path');
const config = require('./config');
const { getPool } = require('./db');
const { requireAuth } = require('./middleware/auth');
const QRCode = require('qrcode');
const { randomId } = require('./utils/id');
const authRoutes = require('./routes/auth');

const app = express();

// Static landing and assets (handled by Vercel from /public in production, but harmless here)
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir, { extensions: ['html'] }));

// Body parsing
app.use(express.json());

// API routes
app.use('/api/auth', authRoutes);

// Health check (no DB)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: config.env });
});

// DB health check
app.get('/api/db/health', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT 1 AS ok');
    return res.json({ status: 'ok', db: 'mysql', ok: rows?.[0]?.ok === 1 });
  } catch (err) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
});

// Authenticated: current user profile
app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.sub;
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT id, name, email, phone, created_at FROM users WHERE id = ?',
      [userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'user not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'internal server error' });
  }
});

// (Owner QR and public owner page removed per requirements)

// -------- Pets API (CRUD + QR) --------

// List pets for current user
app.get('/api/pets', requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.sub;
    const pool = getPool();
    const [rows] = await pool.query(
  'SELECT id, name, species, breed, color, notes, status, photo_url, qr_id, created_at, updated_at FROM pets WHERE owner_id = ? ORDER BY created_at DESC',
      [userId]
    );
    res.json({ pets: rows });
  } catch (err) {
    res.status(500).json({ error: 'internal server error' });
  }
});

// Create pet
app.post('/api/pets', requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.sub;
    const { name, species, breed, color, notes, status, photo_url } = req.body || {};
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name is required' });
    if (status && !['home', 'lost'].includes(status)) return res.status(400).json({ error: 'invalid status' });

    const pool = getPool();
    let qrId;
    let attempts = 0;
    while (attempts < 5) {
      attempts++;
      qrId = randomId(12);
      try {
        const [result] = await pool.query(
          'INSERT INTO pets (owner_id, name, species, breed, color, notes, status, photo_url, qr_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
          [userId, name, species || null, breed || null, color || null, notes || null, status || 'home', photo_url || null, qrId]
        );
        return res.status(201).json({ id: result.insertId, qr_id: qrId });
      } catch (e) {
        // ER_DUP_ENTRY code for mysql2
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

// Update pet (owner only)
app.put('/api/pets/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.sub;
    const { id } = req.params;
    const { name, species, breed, color, notes, status, photo_url } = req.body || {};
    const pool = getPool();
    // Ensure ownership
    const [rows] = await pool.query('SELECT id FROM pets WHERE id = ? AND owner_id = ?', [id, userId]);
    if (!rows.length) return res.status(404).json({ error: 'pet not found' });

    if (status && !['home', 'lost'].includes(status)) return res.status(400).json({ error: 'invalid status' });

    await pool.query(
      'UPDATE pets SET name = COALESCE(?, name), species = COALESCE(?, species), breed = COALESCE(?, breed), color = COALESCE(?, color), notes = COALESCE(?, notes), status = COALESCE(?, status), photo_url = COALESCE(?, photo_url), updated_at = NOW() WHERE id = ?',
      [name ?? null, species ?? null, breed ?? null, color ?? null, notes ?? null, status ?? null, photo_url ?? null, id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'internal server error' });
  }
});

// Delete pet (owner only)
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

// Pet QR (SVG)
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

// Pet QR (PNG)
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

// Public JSON: pet details by qrId
app.get('/api/pets/public/:qrId', async (req, res) => {
  try {
    const { qrId } = req.params;
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT p.name AS pet_name, p.species, p.breed, p.color, p.notes, p.status, p.photo_url,
              u.name AS owner_name, u.phone AS owner_phone, u.email AS owner_email
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
        notes: r.notes || null,
        status: r.status || 'home',
        photo_url: r.photo_url || null,
      },
      owner: {
        name: r.owner_name || '',
        phone: r.owner_phone || null,
        email: r.owner_email || null,
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'internal server error' });
  }
});

// Static pages for login/register
app.get('/login', (req, res) => {
  res.sendFile(path.join(publicDir, 'login.html'));
});
app.get('/register', (req, res) => {
  res.sendFile(path.join(publicDir, 'register.html'));
});
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(publicDir, 'dashboard.html'));
});
// QR scanner page
app.get('/scan', (req, res) => {
  res.sendFile(path.join(publicDir, 'scan.html'));
});
// Kickoff showcase page
app.get('/kickoff', (req, res) => {
  res.sendFile(path.join(publicDir, 'kickoff.html'));
});
// Terms page
app.get('/terms', (req, res) => {
  res.sendFile(path.join(publicDir, 'terms.html'));
});
// Public pet page by qrId (serves static page, which fetches JSON)
app.get('/p/:qrId', (req, res) => {
  res.sendFile(path.join(publicDir, 'pet.html'));
});

// Root
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

module.exports = app;
