const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../db');
const config = require('../config');
let Resend; try { Resend = require('resend').Resend; } catch(_) { Resend = null; }

const router = express.Router();

function generateSixDigitCode() {
  // Returns a zero-padded 6-digit numeric code as string
  const n = Math.floor(Math.random() * 1000000);
  return String(n).padStart(6, '0');
}

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
      'INSERT INTO users (name, last_name, sex, email, password_hash, phone, email_verified) VALUES (?, ?, ?, ?, ?, ?, 0)',
      [name, last_name || null, sex || 'unknown', email, passwordHash, phone || null]
    );
    const userId = result.insertId;
    // Generate 6-digit code and set expiry (15 minutes)
    const code = generateSixDigitCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await pool.query('UPDATE users SET verification_code = ?, verification_expires_at = ? WHERE id = ?', [code, expiresAt, userId]);
    // Send email via Resend (only in production)
    const RK = process.env.RESEND_API_KEY; const FROM = process.env.FROM_EMAIL || 'no-reply@localhost';
    if (Resend && RK && process.env.NODE_ENV === 'production') {
      try {
        const resend = new Resend(RK);
        const subject = 'Tu código de verificación — Petfinder';
        const html = `
          <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">
            <h2>Verifica tu correo</h2>
            <p>Usa este código para completar tu registro. Expira en 15 minutos:</p>
            <p style="font-size:24px; letter-spacing: 4px; font-weight:700">${code}</p>
            <p style="color:#6b7280;font-size:14px">Si no hiciste este registro, ignora este correo.</p>
          </div>`;
        await resend.emails.send({ from: FROM, to: email, subject, html });
      } catch (e) {
        console.error('resend verify code error', e?.message);
      }
    }
    // In non-production, return the code to ease testing
    const payload = { user: { id: userId, name, last_name: last_name || null, sex: sex || 'unknown', email, phone: phone || null } };
    if (process.env.NODE_ENV !== 'production') payload.verification_code = code;
    res.status(201).json(payload);
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
      'SELECT id, name, last_name, sex, email, password_hash, phone, email_verified FROM users WHERE email = ?',
      [email]
    );
  if (!rows.length) return res.status(401).json({ error: 'credenciales inválidas' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'credenciales inválidas' });
    if (!user.email_verified) {
      return res.status(403).json({ error: 'correo no verificado' });
    }
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
      // Enviar por correo si Resend esta configurado
      const RK = process.env.RESEND_API_KEY; const FROM = process.env.FROM_EMAIL || 'no-reply@localhost';
      if (Resend && RK && process.env.NODE_ENV === 'production') {
        try {
          const resend = new Resend(RK);
          const to = email;
          const subject = 'Recuperar contraseña — Petfinder';
          const html = `
            <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">
              <h2>Recuperar contraseña</h2>
              <p>Has solicitado restablecer tu contraseña. Usa el siguiente enlace dentro de 30 minutos:</p>
              <p><a href="${reset_link}" style="color:#2563eb">Restablecer contraseña</a></p>
              <p style="color:#6b7280;font-size:14px">Si no solicitaste este cambio, ignora este correo.</p>
            </div>`;
          await resend.emails.send({ from: FROM, to, subject, html });
        } catch (e) {
          console.error('resend error', e?.message);
        }
      }
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

// --- Verificación de correo con código de 6 dígitos ---
router.post('/verify', async (req, res) => {
  try {
    const { email, code } = req.body || {};
    const emailNorm = (email || '').trim().toLowerCase();
    const codeNorm = String(code || '').trim();
    if (!emailNorm || !codeNorm) return res.status(400).json({ error: 'correo y codigo son obligatorios' });
    if (!/^[0-9]{6}$/.test(codeNorm)) return res.status(400).json({ error: 'el codigo debe tener 6 digitos' });
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT id, verification_code, verification_expires_at, email_verified FROM users WHERE email = ? LIMIT 1',
      [emailNorm]
    );
    if (!rows.length) return res.status(404).json({ error: 'usuario no encontrado' });
    const u = rows[0];
    if (u.email_verified) return res.json({ ok: true, message: 'correo ya verificado' });
    const now = new Date();
    const exp = u.verification_expires_at ? new Date(u.verification_expires_at) : null;
    if (!u.verification_code || !exp || now > exp) {
      return res.status(400).json({ error: 'codigo invalido o expirado' });
    }
    if (String(u.verification_code) !== codeNorm) {
      return res.status(400).json({ error: 'codigo incorrecto' });
    }
    await pool.query('UPDATE users SET email_verified = 1, verification_code = NULL, verification_expires_at = NULL WHERE id = ?', [u.id]);
    // Issue auth token upon successful verification
    const token = jwt.sign({ sub: u.id, email: emailNorm }, config.jwtSecret, { expiresIn: '7d' });
    return res.json({ ok: true, token });
  } catch (err) {
    console.error('verify error', err);
    return res.status(500).json({ error: 'error interno del servidor' });
  }
});
