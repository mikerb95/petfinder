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

/** Ensure users.is_admin column exists for admin gating. */
async function ensureUsersAdminColumn() {
  try {
    const p = getPool();
    const [cols] = await p.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'`,
      [config.db.database]
    );
    const names = new Set((cols || []).map(c => c.COLUMN_NAME));
    if (!names.has('is_admin')) {
      await p.query(`ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER whatsapp_url`);
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Schema ensure (users.is_admin) warning:', err.message);
    }
  }
}

module.exports.ensureUsersAdminColumn = ensureUsersAdminColumn;

/** Ensure users.score column exists for gamified actions. */
async function ensureUsersScoreColumn() {
  try {
    const p = getPool();
    const [cols] = await p.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'`,
      [config.db.database]
    );
    const names = new Set((cols || []).map(c => c.COLUMN_NAME));
    if (!names.has('score')) {
      // Place after is_admin when possible
      await p.query(`ALTER TABLE users ADD COLUMN score INT NOT NULL DEFAULT 0 AFTER is_admin`);
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Schema ensure (users.score) warning:', err.message);
    }
  }
}

module.exports.ensureUsersScoreColumn = ensureUsersScoreColumn;

/** Ensure users referral columns exist: referral_code (unique) and referred_by_user_id (FK self). */
async function ensureUsersReferralColumns() {
  try {
    const p = getPool();
    const [cols] = await p.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'`,
      [config.db.database]
    );
    const names = new Set((cols || []).map(c => c.COLUMN_NAME));
    const alters = [];
    if (!names.has('referral_code')) alters.push("ADD COLUMN referral_code VARCHAR(24) NULL UNIQUE AFTER score");
    if (!names.has('referred_by_user_id')) alters.push("ADD COLUMN referred_by_user_id BIGINT NULL AFTER referral_code");
    if (alters.length) {
      await p.query(`ALTER TABLE users ${alters.join(', ')}`);
      // Add FK separately to avoid errors if column not created yet
      await p.query(`ALTER TABLE users ADD CONSTRAINT fk_users_referrer FOREIGN KEY (referred_by_user_id) REFERENCES users(id) ON DELETE SET NULL`)
        .catch(()=>{});
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Schema ensure (users.referrals) warning:', err.message);
    }
  }
}

module.exports.ensureUsersReferralColumns = ensureUsersReferralColumns;

/** Ensure products table exists for the shop CMS. */
async function ensureProductsTable() {
  try {
    const p = getPool();
    await p.query(`CREATE TABLE IF NOT EXISTS products (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(160) NOT NULL,
      slug VARCHAR(160) NOT NULL UNIQUE,
      price_cents INT NOT NULL,
      currency VARCHAR(3) NOT NULL DEFAULT 'COP',
      stock INT NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1,
      image_url VARCHAR(255) NULL,
      description TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT NULL
    )`);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Schema ensure (products) warning:', err.message);
    }
  }
}

module.exports.ensureProductsTable = ensureProductsTable;

/** Add extra product columns if missing (SKU, weight, tax). */
async function ensureProductsAugments() {
  try {
    const p = getPool();
    const [cols] = await p.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products'`,
      [config.db.database]
    );
    const names = new Set((cols || []).map(c => c.COLUMN_NAME));
    const alters = [];
  if (!names.has('sku')) alters.push("ADD COLUMN sku VARCHAR(64) NULL UNIQUE AFTER slug");
  if (!names.has('brand')) alters.push("ADD COLUMN brand VARCHAR(120) NULL AFTER sku");
  if (!names.has('vendor')) alters.push("ADD COLUMN vendor VARCHAR(160) NULL AFTER brand");
  if (!names.has('barcode')) alters.push("ADD COLUMN barcode VARCHAR(64) NULL UNIQUE AFTER vendor");
  if (!names.has('gtin')) alters.push("ADD COLUMN gtin VARCHAR(14) NULL UNIQUE AFTER barcode");
  if (!names.has('mpn')) alters.push("ADD COLUMN mpn VARCHAR(64) NULL UNIQUE AFTER gtin");
  if (!names.has('model')) alters.push("ADD COLUMN model VARCHAR(120) NULL AFTER mpn");
  if (!names.has('weight_g')) alters.push("ADD COLUMN weight_g INT NULL AFTER stock");
  if (!names.has('length_mm')) alters.push("ADD COLUMN length_mm INT NULL AFTER weight_g");
  if (!names.has('width_mm')) alters.push("ADD COLUMN width_mm INT NULL AFTER length_mm");
  if (!names.has('height_mm')) alters.push("ADD COLUMN height_mm INT NULL AFTER width_mm");
  if (!names.has('dimension_unit')) alters.push("ADD COLUMN dimension_unit VARCHAR(8) NULL DEFAULT 'mm' AFTER height_mm");
  if (!names.has('tax_code')) alters.push("ADD COLUMN tax_code VARCHAR(32) NULL AFTER dimension_unit");
  if (!names.has('visibility')) alters.push("ADD COLUMN visibility ENUM('visible','search','hidden') NOT NULL DEFAULT 'visible' AFTER active");
  if (!names.has('featured')) alters.push("ADD COLUMN featured TINYINT(1) NOT NULL DEFAULT 0 AFTER visibility");
  if (!names.has('position')) alters.push("ADD COLUMN position INT NOT NULL DEFAULT 0 AFTER featured");
  if (!names.has('requires_shipping')) alters.push("ADD COLUMN requires_shipping TINYINT(1) NOT NULL DEFAULT 1 AFTER position");
  if (!names.has('shipping_class')) alters.push("ADD COLUMN shipping_class VARCHAR(64) NULL AFTER requires_shipping");
  if (!names.has('short_description')) alters.push("ADD COLUMN short_description VARCHAR(500) NULL AFTER image_url");
  if (!names.has('video_url')) alters.push("ADD COLUMN video_url VARCHAR(255) NULL AFTER description");
  if (!names.has('meta_title')) alters.push("ADD COLUMN meta_title VARCHAR(160) NULL AFTER video_url");
  if (!names.has('meta_description')) alters.push("ADD COLUMN meta_description VARCHAR(255) NULL AFTER meta_title");
  if (!names.has('canonical_url')) alters.push("ADD COLUMN canonical_url VARCHAR(255) NULL AFTER meta_description");
  if (!names.has('min_qty')) alters.push("ADD COLUMN min_qty INT NOT NULL DEFAULT 1 AFTER canonical_url");
  if (!names.has('max_qty')) alters.push("ADD COLUMN max_qty INT NULL AFTER min_qty");
  if (!names.has('allow_backorder')) alters.push("ADD COLUMN allow_backorder TINYINT(1) NOT NULL DEFAULT 0 AFTER max_qty");
  if (!names.has('cost_price_cents')) alters.push("ADD COLUMN cost_price_cents INT NULL AFTER allow_backorder");
  if (!names.has('compare_at_price_cents')) alters.push("ADD COLUMN compare_at_price_cents INT NULL AFTER cost_price_cents");
  if (!names.has('sale_price_cents')) alters.push("ADD COLUMN sale_price_cents INT NULL AFTER compare_at_price_cents");
  if (!names.has('sale_starts_at')) alters.push("ADD COLUMN sale_starts_at DATETIME NULL AFTER sale_price_cents");
  if (!names.has('sale_ends_at')) alters.push("ADD COLUMN sale_ends_at DATETIME NULL AFTER sale_starts_at");
  if (!names.has('rating_avg')) alters.push("ADD COLUMN rating_avg DECIMAL(3,2) NOT NULL DEFAULT 0.00 AFTER sale_ends_at");
  if (!names.has('rating_count')) alters.push("ADD COLUMN rating_count INT NOT NULL DEFAULT 0 AFTER rating_avg");
    if (alters.length) {
      await p.query(`ALTER TABLE products ${alters.join(', ')}`);
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Schema ensure (products augments) warning:', err.message);
    }
  }
}

module.exports.ensureProductsAugments = ensureProductsAugments;

/** Ensure full Shop schema exists (categories, images, variants, carts, orders, items, payments, shipments, addresses, coupons, inventory). */
async function ensureShopSchema() {
  const p = getPool();
  // Categories (and product mapping)
  await p.query(`CREATE TABLE IF NOT EXISTS categories (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(160) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await p.query(`CREATE TABLE IF NOT EXISTS product_categories (
    product_id BIGINT NOT NULL,
    category_id BIGINT NOT NULL,
    PRIMARY KEY (product_id, category_id),
    CONSTRAINT fk_pc_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_pc_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  )`);

  // Product images
  await p.query(`CREATE TABLE IF NOT EXISTS product_images (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    product_id BIGINT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    alt VARCHAR(160) NULL,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pimg_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  )`);

  // Product variants (basic: size/color)
  await p.query(`CREATE TABLE IF NOT EXISTS product_variants (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    product_id BIGINT NOT NULL,
    sku VARCHAR(64) NULL UNIQUE,
    name VARCHAR(160) NULL,
    size VARCHAR(40) NULL,
    color VARCHAR(40) NULL,
    price_cents INT NULL,
    stock INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT fk_pv_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  )`);

  // Addresses for shipping/billing
  await p.query(`CREATE TABLE IF NOT EXISTS addresses (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NULL,
    full_name VARCHAR(160) NOT NULL,
    line1 VARCHAR(180) NOT NULL,
    line2 VARCHAR(180) NULL,
    city VARCHAR(120) NOT NULL,
    region VARCHAR(120) NULL,
    postal_code VARCHAR(32) NULL,
    country_code CHAR(2) NOT NULL,
    phone VARCHAR(40) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_addr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  )`);

  // Coupons
  await p.query(`CREATE TABLE IF NOT EXISTS coupons (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(64) NOT NULL UNIQUE,
    type ENUM('percent','fixed') NOT NULL,
    percent_off INT NULL,
    amount_off_cents INT NULL,
    currency VARCHAR(3) NULL,
    starts_at DATETIME NULL,
    ends_at DATETIME NULL,
    max_redemptions INT NULL,
    usage_count INT NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  // Carts and items (for future use / guest sessions)
  await p.query(`CREATE TABLE IF NOT EXISTS carts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NULL,
    session_id VARCHAR(64) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  )`);

  await p.query(`CREATE TABLE IF NOT EXISTS cart_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    cart_id BIGINT NOT NULL,
    product_id BIGINT NULL,
    variant_id BIGINT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price_cents INT NULL,
    currency VARCHAR(3) NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ci_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
    CONSTRAINT fk_ci_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    CONSTRAINT fk_ci_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
  )`);

  // Orders
  await p.query(`CREATE TABLE IF NOT EXISTS orders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_number VARCHAR(24) NOT NULL UNIQUE,
    user_id BIGINT NULL,
    email VARCHAR(160) NULL,
    phone VARCHAR(40) NULL,
    billing_address_id BIGINT NULL,
    shipping_address_id BIGINT NULL,
    status ENUM('pending','paid','processing','shipped','delivered','cancelled','refunded') NOT NULL DEFAULT 'pending',
    currency VARCHAR(3) NOT NULL DEFAULT 'COP',
    subtotal_cents INT NOT NULL DEFAULT 0,
    discount_cents INT NOT NULL DEFAULT 0,
    shipping_cents INT NOT NULL DEFAULT 0,
    tax_cents INT NOT NULL DEFAULT 0,
    total_cents INT NOT NULL DEFAULT 0,
    coupon_id BIGINT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT fk_o_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_o_bill_addr FOREIGN KEY (billing_address_id) REFERENCES addresses(id) ON DELETE SET NULL,
    CONSTRAINT fk_o_ship_addr FOREIGN KEY (shipping_address_id) REFERENCES addresses(id) ON DELETE SET NULL,
    CONSTRAINT fk_o_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL
  )`);

  await p.query(`CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    product_id BIGINT NULL,
    variant_id BIGINT NULL,
    name VARCHAR(160) NOT NULL,
    sku VARCHAR(64) NULL,
    unit_price_cents INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    total_cents INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_oi_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    CONSTRAINT fk_oi_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
  )`);

  // Payments
  await p.query(`CREATE TABLE IF NOT EXISTS payments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    provider VARCHAR(40) NOT NULL,
    provider_payment_id VARCHAR(128) NULL,
    status ENUM('requires_action','pending','succeeded','failed','refunded') NOT NULL DEFAULT 'pending',
    amount_cents INT NOT NULL,
    currency VARCHAR(3) NOT NULL,
    receipt_url VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT fk_pay_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  )`);

  // Shipments
  await p.query(`CREATE TABLE IF NOT EXISTS shipments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    carrier VARCHAR(80) NULL,
    tracking_number VARCHAR(120) NULL,
    status ENUM('label_created','in_transit','delivered','returned') NOT NULL DEFAULT 'label_created',
    shipped_at DATETIME NULL,
    delivered_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ship_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  )`);

  // Inventory movements
  await p.query(`CREATE TABLE IF NOT EXISTS inventory_movements (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    product_id BIGINT NULL,
    variant_id BIGINT NULL,
    change_qty INT NOT NULL,
    reason ENUM('order','restock','manual','refund') NOT NULL DEFAULT 'manual',
    reference VARCHAR(160) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_im_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    CONSTRAINT fk_im_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
  )`);
}

module.exports.ensureShopSchema = ensureShopSchema;

/** Ensure Blog schema exists (posts, categories/tags, images, comments, reactions, revisions). */
async function ensureBlogSchema() {
  const p = getPool();
  // Posts
  await p.query(`CREATE TABLE IF NOT EXISTS blog_posts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    author_id BIGINT NULL,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(220) NOT NULL UNIQUE,
    excerpt TEXT NULL,
    content LONGTEXT NOT NULL,
    cover_image_url VARCHAR(255) NULL,
    status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
    published_at DATETIME NULL,
    views_count INT NOT NULL DEFAULT 0,
    meta_title VARCHAR(200) NULL,
    meta_description VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT fk_bpost_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
  )`);
  // Categories and mapping
  await p.query(`CREATE TABLE IF NOT EXISTS blog_categories (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(160) NOT NULL UNIQUE,
    description VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await p.query(`CREATE TABLE IF NOT EXISTS blog_post_categories (
    post_id BIGINT NOT NULL,
    category_id BIGINT NOT NULL,
    PRIMARY KEY (post_id, category_id),
    CONSTRAINT fk_bpc_post FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_bpc_category FOREIGN KEY (category_id) REFERENCES blog_categories(id) ON DELETE CASCADE
  )`);
  // Tags and mapping
  await p.query(`CREATE TABLE IF NOT EXISTS blog_tags (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(160) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await p.query(`CREATE TABLE IF NOT EXISTS blog_post_tags (
    post_id BIGINT NOT NULL,
    tag_id BIGINT NOT NULL,
    PRIMARY KEY (post_id, tag_id),
    CONSTRAINT fk_bpt_post FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_bpt_tag FOREIGN KEY (tag_id) REFERENCES blog_tags(id) ON DELETE CASCADE
  )`);
  // Images per post
  await p.query(`CREATE TABLE IF NOT EXISTS blog_post_images (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    post_id BIGINT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    alt VARCHAR(160) NULL,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bpimg_post FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE
  )`);
  // Comments
  await p.query(`CREATE TABLE IF NOT EXISTS blog_comments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    post_id BIGINT NOT NULL,
    user_id BIGINT NULL,
    parent_id BIGINT NULL,
    body TEXT NOT NULL,
    status ENUM('visible','pending','hidden','deleted') NOT NULL DEFAULT 'visible',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT fk_bcomm_post FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_bcomm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_bcomm_parent FOREIGN KEY (parent_id) REFERENCES blog_comments(id) ON DELETE CASCADE
  )`);
  // Reactions
  await p.query(`CREATE TABLE IF NOT EXISTS blog_post_reactions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    post_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    reaction ENUM('up','down') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bpr_post FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_bpr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_bpr_post_user (post_id, user_id)
  )`);
  await p.query(`CREATE TABLE IF NOT EXISTS blog_comment_reactions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    comment_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    reaction ENUM('up','down') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bcr_comment FOREIGN KEY (comment_id) REFERENCES blog_comments(id) ON DELETE CASCADE,
    CONSTRAINT fk_bcr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_bcr_comment_user (comment_id, user_id)
  )`);
  // Revisions
  await p.query(`CREATE TABLE IF NOT EXISTS blog_post_revisions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    post_id BIGINT NOT NULL,
    editor_user_id BIGINT NULL,
    title VARCHAR(200) NULL,
    content LONGTEXT NOT NULL,
    reason VARCHAR(200) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bprev_post FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_bprev_editor FOREIGN KEY (editor_user_id) REFERENCES users(id) ON DELETE SET NULL
  )`);
}

module.exports.ensureBlogSchema = ensureBlogSchema;

/** Ensure PetBnB schema exists (sitters, bookings, messages, availability, payouts, reviews). */
async function ensureBnbSchema() {
  const p = getPool();
  // Sitters directory
  await p.query(`CREATE TABLE IF NOT EXISTS bnb_sitters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    name VARCHAR(120) NOT NULL,
    bio TEXT NULL,
    city VARCHAR(120) NULL,
    services VARCHAR(255) NULL, -- CSV: boarding,walking,daycare,vetdrive
    price_cents INT NULL,
    currency VARCHAR(10) DEFAULT 'COP',
    experience_years INT DEFAULT 0,
    photo_url VARCHAR(500) NULL,
    rating DECIMAL(3,2) DEFAULT 0.00,
    reviews_count INT DEFAULT 0,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX(city), INDEX(active), INDEX(rating), INDEX(user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  // Ensure extra columns exist (geo + pet types + hours)
  try {
    const [cols] = await p.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'bnb_sitters'`,
      [config.db.database]
    );
    const names = new Set((cols || []).map(c => c.COLUMN_NAME));
    const alters = [];
    if (!names.has('lat')) alters.push("ADD COLUMN lat DECIMAL(9,6) NULL AFTER city");
    if (!names.has('lng')) alters.push("ADD COLUMN lng DECIMAL(9,6) NULL AFTER lat");
    if (!names.has('address')) alters.push("ADD COLUMN address VARCHAR(255) NULL AFTER lng");
    if (!names.has('pet_types')) alters.push("ADD COLUMN pet_types VARCHAR(255) NULL AFTER address");
    if (!names.has('hours_json')) alters.push("ADD COLUMN hours_json TEXT NULL AFTER pet_types");
    if (alters.length) {
      await p.query(`ALTER TABLE bnb_sitters ${alters.join(', ')}`);
    }
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Schema ensure (bnb_sitters extras) warning:', e.message);
    }
  }
  // Availability (optional, simple ranges)
  await p.query(`CREATE TABLE IF NOT EXISTS bnb_availability (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sitter_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    notes VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sitter_id) REFERENCES bnb_sitters(id) ON DELETE CASCADE,
    INDEX(sitter_id), INDEX(start_date), INDEX(end_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  // Bookings
  await p.query(`CREATE TABLE IF NOT EXISTS bnb_bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL,
    sitter_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('pending','confirmed','cancelled','completed') DEFAULT 'pending',
    total_cents INT NULL,
    currency VARCHAR(10) DEFAULT 'COP',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX(owner_id), INDEX(sitter_id), INDEX(status), INDEX(start_date), INDEX(end_date),
    FOREIGN KEY (sitter_id) REFERENCES bnb_sitters(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  // Messages (simple thread by booking)
  await p.query(`CREATE TABLE IF NOT EXISTS bnb_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    sender_user_id INT NOT NULL,
    message TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bnb_bookings(id) ON DELETE CASCADE,
    INDEX(booking_id), INDEX(sender_user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  // Reviews (owner -> sitter)
  await p.query(`CREATE TABLE IF NOT EXISTS bnb_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    owner_id INT NOT NULL,
    sitter_id INT NOT NULL,
    rating INT NOT NULL,
    comment TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bnb_bookings(id) ON DELETE CASCADE,
    INDEX(sitter_id), INDEX(owner_id), INDEX(rating)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  // Payouts (stub)
  await p.query(`CREATE TABLE IF NOT EXISTS bnb_payouts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sitter_id INT NOT NULL,
    booking_id INT NULL,
    amount_cents INT NOT NULL,
    currency VARCHAR(10) DEFAULT 'COP',
    status ENUM('pending','paid','failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sitter_id) REFERENCES bnb_sitters(id) ON DELETE CASCADE,
    INDEX(sitter_id), INDEX(status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
}

module.exports.ensureBnbSchema = ensureBnbSchema;
