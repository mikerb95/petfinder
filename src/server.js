const app = require('./app');
const config = require('./config');
const { ensureUserVerificationColumns } = require('./db');

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Petfinder server running on http://localhost:${PORT} (env: ${config.env})`);
  // best-effort ensure schema for email verification in dev/preview
  try { await ensureUserVerificationColumns(); } catch {}
});
