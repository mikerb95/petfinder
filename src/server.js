const app = require('./app');
const config = require('./config');
const { ensureUserVerificationColumns, ensurePetsCityColumn, ensureUsersCityColumn, ensureExtraPetTables, ensureUsersAdminColumn, ensureUsersScoreColumn, ensureUsersReferralColumns, ensureProductsTable, ensureProductsAugments, ensureShopSchema, ensureBlogSchema, ensureBnbSchema, ensurePetsAdoptionColumns } = require('./db');

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Petfinder server running on http://localhost:${PORT} (env: ${config.env})`);
  // best-effort ensure schema for email verification in dev/preview
  try { await ensureUserVerificationColumns(); } catch {}
  // ensure pets.city exists
  try { await ensurePetsCityColumn(); } catch {}
  // ensure users.city exists
  try { await ensureUsersCityColumn(); } catch {}
  // ensure extra tables exist
  try { await ensureExtraPetTables(); } catch {}
  try { await ensurePetsAdoptionColumns(); } catch {}
  // ensure admin column and products table
  try { await ensureUsersAdminColumn(); } catch {}
  try { await ensureUsersScoreColumn(); } catch {}
  try { await ensureUsersReferralColumns(); } catch {}
  try { await ensureProductsTable(); } catch {}
  try { await ensureProductsAugments(); } catch {}
  try { await ensureShopSchema(); } catch {}
  try { await ensureBlogSchema(); } catch {}
  try { await ensureBnbSchema(); } catch {}
});
