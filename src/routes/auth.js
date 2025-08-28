const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../db');
const config = require('../config');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, last_name, sex, email, password, confirm_password, phone } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'nombre, correo y contraseña son obligatorios' });
    }
    if (password !== confirm_password) {
      return res.status(400).json({ error: 'las contraseñas no coinciden' });
    }
    const pool = getPool();
    const [exists] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (exists.length) {
  return res.status(409).json({ error: 'el correo ya está registrado' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, last_name, sex, email, password_hash, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [name, last_name || null, sex || 'unknown', email, passwordHash, phone || null]
    );
    const userId = result.insertId;
    const token = jwt.sign({ sub: userId, email }, config.jwtSecret, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: userId, name, last_name: last_name || null, sex: sex || 'unknown', email, phone: phone || null } });
  } catch (err) {
  console.error('register error', err);
  res.status(500).json({ error: 'error interno del servidor' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'correo y contraseña son obligatorios' });
    }
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT id, name, last_name, sex, email, password_hash, phone FROM users WHERE email = ?',
      [email]
    );
  if (!rows.length) return res.status(401).json({ error: 'credenciales inválidas' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'credenciales inválidas' });
    const token = jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, last_name: user.last_name, sex: user.sex, email: user.email, phone: user.phone } });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ error: 'error interno del servidor' });
  }
});

module.exports = router;
// --- Recuperacion de contrasena: endpoints ---
// Nota: tokens firmados con JWT, sin estado en DB. Para produccion, considerar rate limit y envio de correo.

router.post('/forgot', async (req, res) => {
  try {
    const emailRaw = (req.body?.email || '').trim();
    if (!emailRaw) return res.status(400).json({ error: 'correo es obligatorio' });
    const email = emailRaw.toLowerCase();
    const pool = getPool();
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    // Generar link si existe, pero responder igual siempre para no filtrar usuarios
    let reset_link = null;
    if (rows.length) {
      const userId = rows[0].id;
      const token = jwt.sign({ sub: userId, email, prp: 'reset' }, config.jwtSecret, { expiresIn: '30m' });
      const base = config.appBaseUrl?.replace(/\/$/, '') || '';
      reset_link = `${base}/reset?token=${encodeURIComponent(token)}`;
      // TODO: Enviar por correo con un proveedor (Resend, Sendgrid, etc.)
    }
    if (process.env.NODE_ENV !== 'production') {
      return res.json({ ok: true, message: 'si el correo existe, se envio un enlace de recuperacion', reset_link });
    }
    return res.json({ ok: true, message: 'si el correo existe, se envio un enlace de recuperacion' });
  } catch (err) {
    return res.json({ ok: true, message: 'si el correo existe, se envio un enlace de recuperacion' });
  }
});

router.post('/reset', async (req, res) => {
  try {
    const { token, password, confirm_password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: 'token y nueva contrasena son obligatorios' });
    if (password !== confirm_password) return res.status(400).json({ error: 'las contrasenas no coinciden' });
    if (String(password).length < 6) return res.status(400).json({ error: 'la contrasena debe tener al menos 6 caracteres' });
    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch (e) {
      return res.status(400).json({ error: 'token invalido o expirado' });
    }
    if (!payload || payload.prp !== 'reset' || !payload.sub) {
      return res.status(400).json({ error: 'token invalido' });
    }
    const userId = payload.sub;
    const pool = getPool();
    const [exists] = await pool.query('SELECT id FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!exists.length) return res.status(404).json({ error: 'usuario no encontrado' });
    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
    return res.json({ ok: true, message: 'contrasena actualizada' });
  } catch (err) {
    console.error('reset error', err);
    return res.status(500).json({ error: 'error interno del servidor' });
  }
});
