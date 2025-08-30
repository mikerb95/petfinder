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
  -- Verificación de correo y rol admin
  email_verified TINYINT(1) NOT NULL DEFAULT 0,
  verification_code VARCHAR(6) DEFAULT NULL,
  verification_expires_at DATETIME DEFAULT NULL,
  is_admin TINYINT(1) NOT NULL DEFAULT 0,
  -- Puntuación del usuario basada en acciones dentro del portal
  score INT NOT NULL DEFAULT 0,
  -- Referidos
  referral_code VARCHAR(24) DEFAULT NULL UNIQUE,
  referred_by_user_id BIGINT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_referrer FOREIGN KEY (referred_by_user_id) REFERENCES users(id) ON DELETE SET NULL
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
  -- Adopciones
  adoption_status ENUM('none','listed','pending','adopted') NOT NULL DEFAULT 'none',
  adoption_fee_cents INT DEFAULT NULL,
  adoption_desc TEXT DEFAULT NULL,
  adoption_listed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT fk_pets_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Nota: para compatibilidad con versiones antiguas de MySQL, se evita
-- USING ON UPDATE en updated_at y se maneja desde la capa de aplicacion.

-- Tabla de adopciones / transferencias
CREATE TABLE IF NOT EXISTS adoptions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  pet_id BIGINT NOT NULL,
  adopter_id BIGINT NOT NULL,
  adoption_date DATE NOT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_adopt_pet FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
  CONSTRAINT fk_adopt_user FOREIGN KEY (adopter_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabla de reportes de mascotas perdidas
CREATE TABLE IF NOT EXISTS lost_reports (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  pet_id BIGINT NOT NULL,
  reporter_id BIGINT NOT NULL,
  last_seen_location VARCHAR(255) NOT NULL,
  report_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('active','found','closed') DEFAULT 'active',
  notes TEXT DEFAULT NULL,
  CONSTRAINT fk_lost_pet FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
  CONSTRAINT fk_lost_user FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabla de historial médico adicional
CREATE TABLE IF NOT EXISTS pet_medical_records (
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
);

-- Tabla de fotos adicionales por mascota
CREATE TABLE IF NOT EXISTS pet_photos (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  pet_id BIGINT NOT NULL,
  photo_url VARCHAR(255) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_photo_pet FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
);

-- Tabla de check-ins o eventos de seguimiento
CREATE TABLE IF NOT EXISTS pet_checkins (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  pet_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  location VARCHAR(255),
  checkin_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT DEFAULT NULL,
  CONSTRAINT fk_checkin_pet FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
  CONSTRAINT fk_checkin_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

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

-- =============================
-- Sección Tienda (Shop)
-- =============================

-- Productos
CREATE TABLE IF NOT EXISTS products (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(160) NOT NULL UNIQUE,
  sku VARCHAR(64) DEFAULT NULL UNIQUE,
  brand VARCHAR(120) DEFAULT NULL,
  vendor VARCHAR(160) DEFAULT NULL,
  barcode VARCHAR(64) DEFAULT NULL UNIQUE,
  gtin VARCHAR(14) DEFAULT NULL UNIQUE,
  mpn VARCHAR(64) DEFAULT NULL UNIQUE,
  model VARCHAR(120) DEFAULT NULL,
  price_cents INT NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'COP',
  stock INT NOT NULL DEFAULT 0,
  weight_g INT DEFAULT NULL,
  length_mm INT DEFAULT NULL,
  width_mm INT DEFAULT NULL,
  height_mm INT DEFAULT NULL,
  dimension_unit VARCHAR(8) DEFAULT 'mm',
  tax_code VARCHAR(32) DEFAULT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  visibility ENUM('visible','search','hidden') NOT NULL DEFAULT 'visible',
  featured TINYINT(1) NOT NULL DEFAULT 0,
  position INT NOT NULL DEFAULT 0,
  requires_shipping TINYINT(1) NOT NULL DEFAULT 1,
  shipping_class VARCHAR(64) DEFAULT NULL,
  image_url VARCHAR(255) DEFAULT NULL,
  short_description VARCHAR(500) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  video_url VARCHAR(255) DEFAULT NULL,
  meta_title VARCHAR(160) DEFAULT NULL,
  meta_description VARCHAR(255) DEFAULT NULL,
  canonical_url VARCHAR(255) DEFAULT NULL,
  min_qty INT NOT NULL DEFAULT 1,
  max_qty INT DEFAULT NULL,
  allow_backorder TINYINT(1) NOT NULL DEFAULT 0,
  cost_price_cents INT DEFAULT NULL,
  compare_at_price_cents INT DEFAULT NULL,
  sale_price_cents INT DEFAULT NULL,
  sale_starts_at DATETIME DEFAULT NULL,
  sale_ends_at DATETIME DEFAULT NULL,
  rating_avg DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  rating_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL
);

-- Categorías y relación N:M con productos
CREATE TABLE IF NOT EXISTS categories (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(160) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_categories (
  product_id BIGINT NOT NULL,
  category_id BIGINT NOT NULL,
  PRIMARY KEY (product_id, category_id),
  CONSTRAINT fk_pc_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_pc_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Imágenes por producto
CREATE TABLE IF NOT EXISTS product_images (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  product_id BIGINT NOT NULL,
  image_url VARCHAR(255) NOT NULL,
  alt VARCHAR(160) DEFAULT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pimg_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Variantes (ej.: talla/color)
CREATE TABLE IF NOT EXISTS product_variants (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  product_id BIGINT NOT NULL,
  sku VARCHAR(64) DEFAULT NULL UNIQUE,
  name VARCHAR(160) DEFAULT NULL,
  size VARCHAR(40) DEFAULT NULL,
  color VARCHAR(40) DEFAULT NULL,
  price_cents INT DEFAULT NULL,
  stock INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT fk_pv_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Direcciones de envío/facturación
CREATE TABLE IF NOT EXISTS addresses (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT DEFAULT NULL,
  full_name VARCHAR(160) NOT NULL,
  line1 VARCHAR(180) NOT NULL,
  line2 VARCHAR(180) DEFAULT NULL,
  city VARCHAR(120) NOT NULL,
  region VARCHAR(120) DEFAULT NULL,
  postal_code VARCHAR(32) DEFAULT NULL,
  country_code CHAR(2) NOT NULL,
  phone VARCHAR(40) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_addr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Cupones de descuento
CREATE TABLE IF NOT EXISTS coupons (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL UNIQUE,
  type ENUM('percent','fixed') NOT NULL,
  percent_off INT DEFAULT NULL,
  amount_off_cents INT DEFAULT NULL,
  currency VARCHAR(3) DEFAULT NULL,
  starts_at DATETIME DEFAULT NULL,
  ends_at DATETIME DEFAULT NULL,
  max_redemptions INT DEFAULT NULL,
  usage_count INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Carritos y items (para sesiones/usuarios)
CREATE TABLE IF NOT EXISTS carts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT DEFAULT NULL,
  session_id VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cart_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  cart_id BIGINT NOT NULL,
  product_id BIGINT DEFAULT NULL,
  variant_id BIGINT DEFAULT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price_cents INT DEFAULT NULL,
  currency VARCHAR(3) DEFAULT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ci_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  CONSTRAINT fk_ci_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT fk_ci_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
);

-- Órdenes
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_number VARCHAR(24) NOT NULL UNIQUE,
  user_id BIGINT DEFAULT NULL,
  email VARCHAR(160) DEFAULT NULL,
  phone VARCHAR(40) DEFAULT NULL,
  billing_address_id BIGINT DEFAULT NULL,
  shipping_address_id BIGINT DEFAULT NULL,
  status ENUM('pending','paid','processing','shipped','delivered','cancelled','refunded') NOT NULL DEFAULT 'pending',
  currency VARCHAR(3) NOT NULL DEFAULT 'COP',
  subtotal_cents INT NOT NULL DEFAULT 0,
  discount_cents INT NOT NULL DEFAULT 0,
  shipping_cents INT NOT NULL DEFAULT 0,
  tax_cents INT NOT NULL DEFAULT 0,
  total_cents INT NOT NULL DEFAULT 0,
  coupon_id BIGINT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT fk_o_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_o_bill_addr FOREIGN KEY (billing_address_id) REFERENCES addresses(id) ON DELETE SET NULL,
  CONSTRAINT fk_o_ship_addr FOREIGN KEY (shipping_address_id) REFERENCES addresses(id) ON DELETE SET NULL,
  CONSTRAINT fk_o_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  product_id BIGINT DEFAULT NULL,
  variant_id BIGINT DEFAULT NULL,
  name VARCHAR(160) NOT NULL,
  sku VARCHAR(64) DEFAULT NULL,
  unit_price_cents INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  total_cents INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_oi_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT fk_oi_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
);

-- Pagos
CREATE TABLE IF NOT EXISTS payments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  provider VARCHAR(40) NOT NULL,
  provider_payment_id VARCHAR(128) DEFAULT NULL,
  status ENUM('requires_action','pending','succeeded','failed','refunded') NOT NULL DEFAULT 'pending',
  amount_cents INT NOT NULL,
  currency VARCHAR(3) NOT NULL,
  receipt_url VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT fk_pay_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Envíos
CREATE TABLE IF NOT EXISTS shipments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  carrier VARCHAR(80) DEFAULT NULL,
  tracking_number VARCHAR(120) DEFAULT NULL,
  status ENUM('label_created','in_transit','delivered','returned') NOT NULL DEFAULT 'label_created',
  shipped_at DATETIME DEFAULT NULL,
  delivered_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ship_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Movimientos de inventario
CREATE TABLE IF NOT EXISTS inventory_movements (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  product_id BIGINT DEFAULT NULL,
  variant_id BIGINT DEFAULT NULL,
  change_qty INT NOT NULL,
  reason ENUM('order','restock','manual','refund') NOT NULL DEFAULT 'manual',
  reference VARCHAR(160) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_im_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT fk_im_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
);

-- =============================
-- Sección Blog (Posts de usuarios)
-- =============================

-- Tabla principal de posts del blog
CREATE TABLE IF NOT EXISTS blog_posts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  author_id BIGINT DEFAULT NULL,
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(220) NOT NULL UNIQUE,
  excerpt TEXT DEFAULT NULL,
  content LONGTEXT NOT NULL,
  cover_image_url VARCHAR(255) DEFAULT NULL,
  status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  published_at DATETIME DEFAULT NULL,
  views_count INT NOT NULL DEFAULT 0,
  meta_title VARCHAR(200) DEFAULT NULL,
  meta_description VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT fk_bpost_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
  KEY idx_bpost_status (status),
  KEY idx_bpost_published_at (published_at)
);

-- Categorías del blog
CREATE TABLE IF NOT EXISTS blog_categories (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(160) NOT NULL UNIQUE,
  description VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Relación N:M posts <-> categorías
CREATE TABLE IF NOT EXISTS blog_post_categories (
  post_id BIGINT NOT NULL,
  category_id BIGINT NOT NULL,
  PRIMARY KEY (post_id, category_id),
  CONSTRAINT fk_bpc_post FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_bpc_category FOREIGN KEY (category_id) REFERENCES blog_categories(id) ON DELETE CASCADE
);

-- Tags del blog
CREATE TABLE IF NOT EXISTS blog_tags (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(160) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Relación N:M posts <-> tags
CREATE TABLE IF NOT EXISTS blog_post_tags (
  post_id BIGINT NOT NULL,
  tag_id BIGINT NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  CONSTRAINT fk_bpt_post FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_bpt_tag FOREIGN KEY (tag_id) REFERENCES blog_tags(id) ON DELETE CASCADE
);

-- Imágenes adicionales por post
CREATE TABLE IF NOT EXISTS blog_post_images (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  post_id BIGINT NOT NULL,
  image_url VARCHAR(255) NOT NULL,
  alt VARCHAR(160) DEFAULT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bpimg_post FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE
);

-- Comentarios por post
CREATE TABLE IF NOT EXISTS blog_comments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  post_id BIGINT NOT NULL,
  user_id BIGINT DEFAULT NULL,
  parent_id BIGINT DEFAULT NULL,
  body TEXT NOT NULL,
  status ENUM('visible','pending','hidden','deleted') NOT NULL DEFAULT 'visible',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT fk_bcomm_post FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_bcomm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_bcomm_parent FOREIGN KEY (parent_id) REFERENCES blog_comments(id) ON DELETE CASCADE,
  KEY idx_bcomm_post (post_id),
  KEY idx_bcomm_status (status)
);

-- Likes por usuario y post (únicos)
CREATE TABLE IF NOT EXISTS blog_post_reactions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  post_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  reaction ENUM('up','down') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bpr_post FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_bpr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_bpr_post_user (post_id, user_id)
);

-- Reacciones a comentarios (thumb up/down)
CREATE TABLE IF NOT EXISTS blog_comment_reactions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  comment_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  reaction ENUM('up','down') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bcr_comment FOREIGN KEY (comment_id) REFERENCES blog_comments(id) ON DELETE CASCADE,
  CONSTRAINT fk_bcr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_bcr_comment_user (comment_id, user_id)
);

-- Historial de revisiones de un post
CREATE TABLE IF NOT EXISTS blog_post_revisions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  post_id BIGINT NOT NULL,
  editor_user_id BIGINT DEFAULT NULL,
  title VARCHAR(200) DEFAULT NULL,
  content LONGTEXT NOT NULL,
  reason VARCHAR(200) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bprev_post FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_bprev_editor FOREIGN KEY (editor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  KEY idx_bprev_post (post_id)
);

-- =============================
-- Sección PetBnB (Guardería y cuidadores)
-- =============================

CREATE TABLE IF NOT EXISTS bnb_sitters (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT DEFAULT NULL,
  name VARCHAR(120) NOT NULL,
  bio TEXT DEFAULT NULL,
  city VARCHAR(120) DEFAULT NULL,
  lat DECIMAL(9,6) DEFAULT NULL,
  lng DECIMAL(9,6) DEFAULT NULL,
  address VARCHAR(255) DEFAULT NULL,
  pet_types VARCHAR(255) DEFAULT NULL,
  hours_json TEXT DEFAULT NULL,
  services VARCHAR(255) DEFAULT NULL,
  price_cents INT DEFAULT NULL,
  currency VARCHAR(10) DEFAULT 'COP',
  experience_years INT DEFAULT 0,
  photo_url VARCHAR(500) DEFAULT NULL,
  rating DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  reviews_count INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS bnb_availability (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  sitter_id BIGINT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bnb_bookings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  owner_id BIGINT NOT NULL,
  sitter_id BIGINT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('pending','confirmed','cancelled','completed') NOT NULL DEFAULT 'pending',
  total_cents INT DEFAULT NULL,
  currency VARCHAR(10) DEFAULT 'COP',
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS bnb_messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  booking_id BIGINT NOT NULL,
  sender_user_id BIGINT NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bnb_reviews (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  booking_id BIGINT NOT NULL,
  owner_id BIGINT NOT NULL,
  sitter_id BIGINT NOT NULL,
  rating INT NOT NULL,
  comment TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bnb_payouts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  sitter_id BIGINT NOT NULL,
  booking_id BIGINT DEFAULT NULL,
  amount_cents INT NOT NULL,
  currency VARCHAR(10) DEFAULT 'COP',
  status ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
