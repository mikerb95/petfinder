const jwt = require('jsonwebtoken');
const config = require('../config');

function requireAuth(req, res, next) {
    const auth = req.headers.authorization || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (!match) {
        return res.status(401).json({ error: 'falta el token bearer' });
    }
    const token = (match[1] || '').trim();
    try {
        const payload = jwt.verify(token, config.jwtSecret);
        req.auth = payload;
        return next();
    } catch (err) {
        return res.status(401).json({ error: 'token inválido o expirado' });
    }
}

module.exports = { requireAuth };
