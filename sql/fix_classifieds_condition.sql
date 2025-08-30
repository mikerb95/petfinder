-- Fix: quote reserved column name in classifieds
-- Import this file first, then run your main schema/seeds.

CREATE TABLE IF NOT EXISTS classifieds (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  title VARCHAR(160) NOT NULL,
  category VARCHAR(80) DEFAULT NULL,
  `condition` ENUM('nuevo','como_nuevo','buen_estado','usado') NOT NULL DEFAULT 'buen_estado',
  description TEXT DEFAULT NULL,
  price_cents INT NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'COP',
  city VARCHAR(120) DEFAULT NULL,
  photo_url VARCHAR(500) DEFAULT NULL,
  status ENUM('active','sold','hidden') NOT NULL DEFAULT 'active',
  views INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  KEY idx_class_user (user_id),
  KEY idx_class_status (status),
  KEY idx_class_category (category),
  KEY idx_class_city (city)
);
