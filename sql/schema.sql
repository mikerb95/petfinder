-- Esquema minimo para Petfinder

CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) DEFAULT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(40),
  city VARCHAR(120) DEFAULT NULL,
  instagram_url VARCHAR(255) DEFAULT NULL,
  facebook_url VARCHAR(255) DEFAULT NULL,
  whatsapp_url VARCHAR(255) DEFAULT NULL,
  sex ENUM('male','female','unknown') NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de mascotas
CREATE TABLE IF NOT EXISTS pets (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  owner_id BIGINT NOT NULL,
  name VARCHAR(120) NOT NULL,
  species VARCHAR(60) DEFAULT NULL,
  breed VARCHAR(120) DEFAULT NULL,
  color VARCHAR(120) DEFAULT NULL,
  city VARCHAR(120) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  status ENUM('home','lost') NOT NULL DEFAULT 'home',
  photo_url VARCHAR(255) DEFAULT NULL,
  -- Campos de salud e identificacion
  birthdate DATE DEFAULT NULL,
  sex ENUM('male','female','unknown') NOT NULL DEFAULT 'unknown',
  weight_kg DECIMAL(5,2) DEFAULT NULL,
  sterilized TINYINT(1) NOT NULL DEFAULT 0,
  microchip_id VARCHAR(40) DEFAULT NULL,
  allergies TEXT DEFAULT NULL,
  medical_conditions TEXT DEFAULT NULL,
  medications TEXT DEFAULT NULL,
  last_vet_visit DATE DEFAULT NULL,
  vet_clinic_name VARCHAR(120) DEFAULT NULL,
  vet_clinic_phone VARCHAR(40) DEFAULT NULL,
  vaccine_card_url VARCHAR(255) DEFAULT NULL,
  qr_id VARCHAR(32) NOT NULL UNIQUE,
  nfc_id VARCHAR(32) DEFAULT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT fk_pets_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Nota: para compatibilidad con versiones antiguas de MySQL, se evita
-- USING ON UPDATE en updated_at y se maneja desde la capa de aplicacion.

-- Registros de vacunacion por mascota
CREATE TABLE IF NOT EXISTS pet_vaccinations (
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
);

-- Registros de desparasitacion por mascota
CREATE TABLE IF NOT EXISTS pet_dewormings (
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
);
