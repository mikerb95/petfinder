const { getPool } = require('../src/db');

(async function run() {
  const pool = getPool();
  try {
    await pool.query("ALTER TABLE users ADD COLUMN photo_url VARCHAR(255) DEFAULT NULL");
    console.log('Added users.photo_url');
  } catch (e) {
    // If already exists, ignore
    if (e && e.code === 'ER_DUP_FIELDNAME') {
      console.log('users.photo_url already exists');
    } else {
      console.error('Migration error:', e.message);
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
})();
