const fs = require('fs');
const path = require('path');
const { getPool } = require('../src/db');

async function main() {
  const sqlPath = path.join(__dirname, '..', 'sql', 'schema.sql');
  const ddl = fs.readFileSync(sqlPath, 'utf8');
  const pool = getPool();
  const statements = ddl
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    // console.log('Ejecutando:', stmt.slice(0, 80));
    await pool.query(stmt);
  }
  console.log('DB schema applied.');
  await pool.end();
}

main().catch(err => {
  console.error('DB init error:', err.message);
  process.exit(1);
});
