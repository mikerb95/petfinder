const { getPool } = require('../src/db');

async function addColumn(sql) {
  const pool = getPool();
  try { await pool.query(sql); } catch (e) {
    if (e && (e.code === 'ER_DUP_FIELDNAME' || /Duplicate column/i.test(e.message))) {
      // ignore if already exists
      return;
    }
    throw e;
  }
}

(async function run(){
  const pool = getPool();
  try {
    // Add columns to pets if missing
    await addColumn("ALTER TABLE pets ADD COLUMN birthdate DATE DEFAULT NULL");
    await addColumn("ALTER TABLE pets ADD COLUMN sex ENUM('male','female','unknown') NOT NULL DEFAULT 'unknown'");
    await addColumn("ALTER TABLE pets ADD COLUMN weight_kg DECIMAL(5,2) DEFAULT NULL");
    await addColumn("ALTER TABLE pets ADD COLUMN sterilized TINYINT(1) NOT NULL DEFAULT 0");
    await addColumn("ALTER TABLE pets ADD COLUMN microchip_id VARCHAR(40) DEFAULT NULL");
    await addColumn("ALTER TABLE pets ADD COLUMN allergies TEXT DEFAULT NULL");
    await addColumn("ALTER TABLE pets ADD COLUMN medical_conditions TEXT DEFAULT NULL");
    await addColumn("ALTER TABLE pets ADD COLUMN medications TEXT DEFAULT NULL");
    await addColumn("ALTER TABLE pets ADD COLUMN last_vet_visit DATE DEFAULT NULL");
    await addColumn("ALTER TABLE pets ADD COLUMN vet_clinic_name VARCHAR(120) DEFAULT NULL");
    await addColumn("ALTER TABLE pets ADD COLUMN vet_clinic_phone VARCHAR(40) DEFAULT NULL");
    await addColumn("ALTER TABLE pets ADD COLUMN vaccine_card_url VARCHAR(255) DEFAULT NULL");

    // Create event tables if not exist
    await pool.query(`CREATE TABLE IF NOT EXISTS pet_vaccinations (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      pet_id BIGINT NOT NULL,
      vaccine_type VARCHAR(80) NOT NULL,
      product_name VARCHAR(120) DEFAULT NULL,
      lot_number VARCHAR(60) DEFAULT NULL,
      dose_ml DECIMAL(4,2) DEFAULT NULL,
      route ENUM('sc','im','oral','intranasal','other') DEFAULT NULL,
      date_administered DATE NOT NULL,
      next_due DATE DEFAULT NULL,
      veterinarian VARCHAR(120) DEFAULT NULL,
      clinic VARCHAR(120) DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      document_url VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT NULL,
      CONSTRAINT fk_vacc_pet FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
      KEY idx_vacc_pet (pet_id),
      KEY idx_vacc_due (next_due),
      KEY idx_vacc_type (vaccine_type)
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS pet_dewormings (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      pet_id BIGINT NOT NULL,
      product_name VARCHAR(120) NOT NULL,
      active_ingredient VARCHAR(120) DEFAULT NULL,
      internal_treatment TINYINT(1) NOT NULL DEFAULT 1,
      external_treatment TINYINT(1) NOT NULL DEFAULT 0,
      dose_mg_per_kg DECIMAL(6,2) DEFAULT NULL,
      weight_kg DECIMAL(5,2) DEFAULT NULL,
      route ENUM('oral','topical','sc','im','other') DEFAULT NULL,
      date_administered DATE NOT NULL,
      next_due DATE DEFAULT NULL,
      lot_number VARCHAR(60) DEFAULT NULL,
      veterinarian VARCHAR(120) DEFAULT NULL,
      clinic VARCHAR(120) DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      document_url VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT NULL,
      CONSTRAINT fk_dew_pet FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
      KEY idx_dew_pet (pet_id),
      KEY idx_dew_due (next_due),
      KEY idx_dew_product (product_name)
    )`);

    console.log('Migration pet health: OK');
  } catch (e) {
    console.error('Migration pet health error:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
