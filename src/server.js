const app = require('./app');
const config = require('./config');
const { ensureUserVerificationColumns, ensurePetsCityColumn, ensureUsersCityColumn } = require('./db');

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Petfinder server running on http://localhost:${PORT} (env: ${config.env})`);
  // best-effort ensure schema for email verification in dev/preview
  try { await ensureUserVerificationColumns(); } catch {}
  // ensure pets.city exists
  try { await ensurePetsCityColumn(); } catch {}
  // ensure users.city exists
  try { await ensureUsersCityColumn(); } catch {}
});
