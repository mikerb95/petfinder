const { getPool } = require('../db');

async function requireAdmin(req, res, next) {
  try {
    const userId = req.auth?.sub;
    if (!userId) return res.status(401).json({ error: 'no auth' });
    const p = getPool();
    const [rows] = await p.query('SELECT is_admin FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!rows.length || rows[0].is_admin !== 1) return res.status(403).json({ error: 'forbidden' });
    return next();
  } catch (err) {
    return res.status(500).json({ error: 'internal server error' });
  }
}

module.exports = { requireAdmin };
