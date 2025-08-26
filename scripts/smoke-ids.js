const { getPool } = require('../src/db');
const { randomId } = require('../src/utils/id');

(async () => {
  const pool = getPool();
  try {
    const tried = new Set();
    for (let i = 0; i < 1000; i++) {
      const id = randomId(12);
      if (tried.has(id)) throw new Error('randomId produced a collision in-memory');
      tried.add(id);
    }
    console.log('randomId uniqueness in-memory: PASS (1000)');
    // DB uniqueness smoke (if table exists)
    const ids = Array.from({ length: 20 }, () => randomId(12));
    for (const id of ids) {
      try {
        await pool.query('INSERT INTO pets (owner_id, name, qr_id) VALUES (0, "test", ?)', [id]);
      } catch (e) {
        if (e && e.code === 'ER_NO_SUCH_TABLE') {
          console.log('pets table not present, skipping DB uniqueness smoke');
          break;
        }
      }
    }
    console.log('DB uniqueness smoke: attempted 20 inserts');
  } finally {
    await pool.end();
  }
})().catch(err => { console.error(err); process.exit(1); });
