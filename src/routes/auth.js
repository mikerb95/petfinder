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
