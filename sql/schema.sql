-- Minimal schema for Petfinder

CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(40),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pets table
CREATE TABLE IF NOT EXISTS pets (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  owner_id BIGINT NOT NULL,
  name VARCHAR(120) NOT NULL,
  species VARCHAR(60) DEFAULT NULL,
  breed VARCHAR(120) DEFAULT NULL,
  color VARCHAR(120) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  status ENUM('home','lost') NOT NULL DEFAULT 'home',
  photo_url VARCHAR(255) DEFAULT NULL,
  qr_id VARCHAR(32) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT fk_pets_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Note: For maximum compatibility with older MySQL versions, we avoid
-- USING ON UPDATE on updated_at and manage it from the application layer.
