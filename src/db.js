const mysql = require('mysql2/promise');
const config = require('./config');

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
  ssl: config.db.ssl,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
    });
  }
  return pool;
}

async function ensureUserVerificationColumns() {
  try {
    const p = getPool();
    // Check existing columns
    const [cols] = await p.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'`,
      [config.db.database]
    );
    const names = new Set((cols || []).map(c => c.COLUMN_NAME));
    const alters = [];
    if (!names.has('email_verified')) alters.push("ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0");
    if (!names.has('verification_code')) alters.push("ADD COLUMN verification_code VARCHAR(6) NULL");
    if (!names.has('verification_expires_at')) alters.push("ADD COLUMN verification_expires_at DATETIME NULL");
    if (alters.length) {
      const sql = `ALTER TABLE users ${alters.join(', ')}`;
      await p.query(sql);
    }
  } catch (err) {
    // Log but do not crash app; schema may be managed externally
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Schema ensure warning:', err.message);
    }
  }
}

module.exports = { getPool, ensureUserVerificationColumns };
