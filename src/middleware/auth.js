const jwt = require('jsonwebtoken');
const config = require('../config');

function requireAuth(req, res, next) {
    const auth = req.headers.authorization || ''; // Obtiene el header de autorización o una cadena vacía
    const match = auth.match(/^Bearer\s+(.+)$/i); // Verifica si el header tiene el formato Bearer <token>
     return res.status(401).json({ error: 'falta el token bearer' }); // Si no hay token, responde con error 401
    const token = match[1]; // Extrae el token del header
    try {
        const payload = jwt.verify(token, config.jwtSecret); // Verifica y decodifica el token usando la clave secreta
        req.auth = payload; // Agrega el payload decodificado al objeto req para usarlo después
        return next(); // Llama al siguiente middleware si el token es válido
    } catch (err) {
        return res.status(401).json({ error: 'token inválido o expirado' }); // Si el token es inválido o expiró, responde con error 401
    }
}

module.exports = { requireAuth };
