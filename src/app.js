const express = require('express');
const path = require('path');
const config = require('./config');
const { getPool } = require('./db');
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

// Static pages for login/register
app.get('/login', (req, res) => {
  res.sendFile(path.join(publicDir, 'login.html'));
});
app.get('/register', (req, res) => {
  res.sendFile(path.join(publicDir, 'register.html'));
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
