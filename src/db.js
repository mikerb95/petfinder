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

/** Ensure users.city column exists. */
async function ensureUsersCityColumn() {
  try {
    const p = getPool();
    const [cols] = await p.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'`,
      [config.db.database]
    );
    const names = new Set((cols || []).map(c => c.COLUMN_NAME));
    if (!names.has('city')) {
      await p.query(`ALTER TABLE users ADD COLUMN city VARCHAR(120) NULL AFTER phone`);
    }
    // Social links columns
    const alters = [];
    if (!names.has('instagram_url')) alters.push("ADD COLUMN instagram_url VARCHAR(255) NULL AFTER city");
    if (!names.has('facebook_url')) alters.push("ADD COLUMN facebook_url VARCHAR(255) NULL AFTER instagram_url");
    if (!names.has('whatsapp_url')) alters.push("ADD COLUMN whatsapp_url VARCHAR(255) NULL AFTER facebook_url");
    if (alters.length) {
      await p.query(`ALTER TABLE users ${alters.join(', ')}`);
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Schema ensure (users.city) warning:', err.message);
    }
  }
}

module.exports = { getPool, ensureUserVerificationColumns, ensureUsersCityColumn };
/** Ensure pets.city column exists. */
async function ensurePetsCityColumn() {
  try {
    const p = getPool();
    const [cols] = await p.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'pets'`,
      [config.db.database]
    );
    const names = new Set((cols || []).map(c => c.COLUMN_NAME));
  const alters = [];
  if (!names.has('city')) alters.push("ADD COLUMN city VARCHAR(120) NULL AFTER color");
  if (!names.has('nfc_id')) alters.push("ADD COLUMN nfc_id VARCHAR(32) NULL UNIQUE AFTER qr_id");
  if (alters.length) await p.query(`ALTER TABLE pets ${alters.join(', ')}`);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Schema ensure (pets.city) warning:', err.message);
    }
  }
}

module.exports.ensurePetsCityColumn = ensurePetsCityColumn;

/** Ensure auxiliary tables for adoptions, lost_reports, pet_medical_records, pet_photos, pet_checkins exist. */
async function ensureExtraPetTables() {
  const p = getPool();
  // Best-effort creation (IF NOT EXISTS)
  await p.query(`CREATE TABLE IF NOT EXISTS adoptions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    pet_id BIGINT NOT NULL,
    adopter_id BIGINT NOT NULL,
    adoption_date DATE NOT NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_adopt_pet FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
    CONSTRAINT fk_adopt_user FOREIGN KEY (adopter_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await p.query(`CREATE TABLE IF NOT EXISTS lost_reports (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    pet_id BIGINT NOT NULL,
    reporter_id BIGINT NOT NULL,
    last_seen_location VARCHAR(255) NOT NULL,
    report_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('active','found','closed') DEFAULT 'active',
    notes TEXT DEFAULT NULL,
    CONSTRAINT fk_lost_pet FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
    CONSTRAINT fk_lost_user FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await p.query(`CREATE TABLE IF NOT EXISTS pet_medical_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    pet_id BIGINT NOT NULL,
    visit_date DATE NOT NULL,
    reason TEXT,
    treatment TEXT,
    prescription TEXT,
    veterinarian VARCHAR(120),
    clinic VARCHAR(120),
    document_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_med_pet FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
  )`);
  await p.query(`CREATE TABLE IF NOT EXISTS pet_photos (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    pet_id BIGINT NOT NULL,
    photo_url VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_photo_pet FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
  )`);
  await p.query(`CREATE TABLE IF NOT EXISTS pet_checkins (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    pet_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    location VARCHAR(255),
    checkin_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT DEFAULT NULL,
    CONSTRAINT fk_checkin_pet FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
    CONSTRAINT fk_checkin_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
}

module.exports.ensureExtraPetTables = ensureExtraPetTables;
