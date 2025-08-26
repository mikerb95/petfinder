const express = require('express');
const path = require('path');
const config = require('./config');
const { getPool } = require('./db');
const { requireAuth } = require('./middleware/auth');
const QRCode = require('qrcode');
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

// Generate Owner QR (SVG) pointing to the public owner contact page
app.get('/api/qr/owner.svg', requireAuth, async (req, res) => {
  try {
    const ownerId = req.auth?.sub;
    const url = new URL('/o/' + ownerId, config.appBaseUrl).toString();
    const svg = await QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#111111', light: '#ffffff' } });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (err) {
    res.status(500).json({ error: 'qr generation failed' });
  }
});

// Generate Owner QR (PNG)
app.get('/api/qr/owner.png', requireAuth, async (req, res) => {
  try {
    const ownerId = req.auth?.sub;
    const url = new URL('/o/' + ownerId, config.appBaseUrl).toString();
    const buf = await QRCode.toBuffer(url, { type: 'png', margin: 1, scale: 8 });
    res.setHeader('Content-Type', 'image/png');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: 'qr generation failed' });
  }
});

// Public owner contact page (by ownerId)
app.get('/o/:ownerId', async (req, res) => {
  try {
    const ownerId = req.params.ownerId;
    const pool = getPool();
    const [rows] = await pool.query('SELECT name, phone, email FROM users WHERE id = ?', [ownerId]);
    if (!rows.length) return res.status(404).send('<h1>No encontrado</h1>');
    const owner = rows[0];
    res.send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Contacto del propietario</title><link rel="stylesheet" href="/assets/css/landing.css"></head><body><main class="section"><div class="container" style="max-width:720px;"><h1>Contacto del propietario</h1><p><strong>Nombre:</strong> ${owner.name || ''}</p><p><strong>Teléfono:</strong> ${owner.phone || 'No disponible'}</p><p><strong>Correo:</strong> ${owner.email || 'No disponible'}</p><p><a class="button" href="/">Volver al inicio</a></p></div></main></body></html>`);
  } catch (err) {
    res.status(500).send('Error del servidor');
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
app.get('/p/:qrId', (req, res) => {
  const { qrId } = req.params;
  res.send(`<!doctype html><html><body><h1>Página pública de mascota</h1><p>QR ID: ${qrId}</p><p>(Placeholder)</p><p><a href="/">Volver al inicio</a></p></body></html>`);
});

// Root
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

module.exports = app;
