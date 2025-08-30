-- Seed demo data: 20 users, 20 pets (2 in adoption), sample blog posts, classifieds, and 10 Bogota sitters
-- Safe to run after schema.sql. Adjust as needed for your environment.

START TRANSACTION;

-- Use a common bcrypt hash for all demo users (placeholder). If you need login, replace with a real bcrypt of 'password'.
-- bcrypt hash for 'password' generated with cost 10
SET @PWD := '$2a$10$0iQwQfEYYYQv8sihZtq5V.YSFJy/EUlJkKklIFPovTExq6JZcHITu';

-- 20 users
INSERT INTO users (name, last_name, email, password_hash, phone, city, instagram_url, facebook_url, whatsapp_url, sex, email_verified, is_admin, score, referral_code)
VALUES
  ('Ana', 'García', 'ana1@example.com', @PWD, '+57 3001111111', 'Bogotá', 'https://instagram.com/ana', NULL, 'https://wa.me/573001111111', 'female', 1, 1, 10, 'REFANA1'),
  ('Bruno', 'López', 'bruno2@example.com', @PWD, '+57 3002222222', 'Medellín', NULL, 'https://facebook.com/bruno', NULL, 'male', 1, 0, 5, 'REFBRU2'),
  ('Carla', 'Méndez', 'carla3@example.com', @PWD, '+57 3003333333', 'Cali', NULL, NULL, NULL, 'female', 0, 0, 0, 'REFCAR3'),
  ('Diego', 'Rojas', 'diego4@example.com', @PWD, '+57 3004444444', 'Bogotá', NULL, NULL, NULL, 'male', 0, 0, 0, 'REFDIE4'),
  ('Elena', 'Pérez', 'elena5@example.com', @PWD, '+57 3005555555', 'Bogotá', 'https://instagram.com/elenap', NULL, NULL, 'female', 1, 0, 2, 'REFELE5'),
  ('Felipe', 'Castro', 'felipe6@example.com', @PWD, '+57 3006666666', 'Barranquilla', NULL, NULL, NULL, 'male', 0, 0, 0, 'REFFEL6'),
  ('Gabriela', 'Romero', 'gaby7@example.com', @PWD, '+57 3007777777', 'Bucaramanga', NULL, NULL, NULL, 'female', 0, 0, 0, 'REFGAB7'),
  ('Hugo', 'Núñez', 'hugo8@example.com', @PWD, '+57 3008888888', 'Bogotá', NULL, NULL, 'https://wa.me/573008888888', 'male', 0, 0, 0, 'REFHUG8'),
  ('Irene', 'Soto', 'irene9@example.com', @PWD, '+57 3009999999', 'Medellín', NULL, NULL, NULL, 'female', 0, 0, 0, 'REFIRE9'),
  ('Jorge', 'Díaz', 'jorge10@example.com', @PWD, '+57 3010000001', 'Cali', NULL, NULL, NULL, 'male', 0, 0, 0, 'REFJOR10'),
  ('Karen', 'Suárez', 'karen11@example.com', @PWD, '+57 3010000002', 'Bogotá', NULL, NULL, NULL, 'female', 0, 0, 0, 'REFKAR11'),
  ('Luis', 'Martínez', 'luis12@example.com', @PWD, '+57 3010000003', 'Bogotá', NULL, NULL, NULL, 'male', 0, 0, 0, 'REFLUI12'),
  ('María', 'Ortiz', 'maria13@example.com', @PWD, '+57 3010000004', 'Bogotá', NULL, NULL, NULL, 'female', 0, 0, 0, 'REFMAR13'),
  ('Nicolás', 'Quintero', 'nico14@example.com', @PWD, '+57 3010000005', 'Medellín', NULL, NULL, NULL, 'male', 0, 0, 0, 'REFNIC14'),
  ('Olga', 'Prieto', 'olga15@example.com', @PWD, '+57 3010000006', 'Cali', NULL, NULL, NULL, 'female', 0, 0, 0, 'REFOLG15'),
  ('Pablo', 'Salas', 'pablo16@example.com', @PWD, '+57 3010000007', 'Bogotá', NULL, NULL, NULL, 'male', 0, 0, 0, 'REFPAB16'),
  ('Quique', 'Vargas', 'quique17@example.com', @PWD, '+57 3010000008', 'Bogotá', NULL, NULL, NULL, 'male', 0, 0, 0, 'REFQUI17'),
  ('Rosa', 'Cano', 'rosa18@example.com', @PWD, '+57 3010000009', 'Bogotá', NULL, NULL, NULL, 'female', 0, 0, 0, 'REFROS18'),
  ('Sofía', 'Beltrán', 'sofia19@example.com', @PWD, '+57 3010000010', 'Barranquilla', NULL, NULL, NULL, 'female', 0, 0, 0, 'REFSOF19'),
  ('Tomás', 'Guzmán', 'tomas20@example.com', @PWD, '+57 3010000011', 'Bogotá', NULL, NULL, NULL, 'male', 0, 0, 0, 'REFTOM20');

-- Pets: 20 (IDs assumed to be 1..20 in insertion order above)
-- Two pets listed for adoption: users 5 and 12
INSERT INTO pets (owner_id, name, species, breed, color, city, notes, status, photo_url,
                  birthdate, sex, weight_kg, sterilized, microchip_id, allergies, medical_conditions, medications,
                  last_vet_visit, vet_clinic_name, vet_clinic_phone, vaccine_card_url,
                  qr_id, nfc_id, adoption_status, adoption_fee_cents, adoption_desc, adoption_listed_at)
VALUES
  (1,  'Luna',  'perro', 'Labrador', 'Negro',  'Bogotá', 'Amigable', 'home', NULL, NULL, 'female', 25.0, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'SEEDQR00001', NULL, 'none', NULL, NULL, NULL),
  (2,  'Max',   'perro', 'Criollo',  'Marrón', 'Medellín', 'Juguetón', 'home', NULL, NULL, 'male', 18.5, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'SEEDQR00002', NULL, 'none', NULL, NULL, NULL),
  (3,  'Misu',  'gato',  'Siames',   'Crema',  'Cali', 'Tranquila', 'home', NULL, NULL, 'female', 4.2, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'SEEDQR00003', NULL, 'none', NULL, NULL, NULL),
  (4,  'Rocky', 'perro', 'Criollo',  'Negro',  'Bogotá', NULL, 'home', NULL, NULL, 'male', 20.0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'SEEDQR00004', NULL, 'none', NULL, NULL, NULL),
  (5,  'Nala',  'gato',  'Criollo',  'Gris',   'Bogotá', 'Cariñosa', 'home', NULL, NULL, 'female', 3.8, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'SEEDQR00005', NULL, 'listed', 80000, 'Adopción responsable. Vacunada y esterilizada.', NOW()),
  (6,  'Firulais','perro','Beagle',  'Tricolor','Barranquilla', NULL, 'home', NULL, NULL, 'male', 12.0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'SEEDQR00006', NULL, 'none', NULL, NULL, NULL),
  (7,  'Pelusa','gato',  'Criollo',  'Blanco', 'Bucaramanga', NULL, 'home', NULL, NULL, 'female', 3.5, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'SEEDQR00007', NULL, 'none', NULL, NULL, NULL), 
  (8,  'Toby',  'perro', 'Poodle',   'Blanco', 'Bogotá', NULL, 'home', NULL, NULL, 'male', 6.0, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'SEEDQR00008', NULL, 'none', NULL, NULL, NULL),
  (9,  'Coco',  'gato',  'Criollo',  'Atigrado','Medellín', NULL, 'home', NULL, NULL, 'male', 4.5, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'SEEDQR00009', NULL, 'none', NULL, NULL, NULL),
  (10, 'Bobi',  'perro', 'Criollo',  'Café',   'Cali', NULL, 'home', NULL, NULL, 'male', 15.0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'SEEDQR00010', NULL, 'none', NULL, NULL, NULL),
  (11, 'Maya',  'gato',  'Angora',   'Blanco', 'Bogotá', NULL, 'home', NULL, NULL, 'female', 3.9, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'SEEDQR00011', NULL, 'none', NULL, NULL, NULL),
  (12, 'Rex',   'perro', 'Criollo',  'Negro',  'Bogotá', 'Adorable', 'home', NULL, NULL, 'male', 22.0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'SEEDQR00012', NULL, 'listed', 60000, 'Busca familia amorosa. Vacunado.', NOW()),
  (13, 'Kira',  'gato',  'Criollo',  'Marrón', 'Bogotá', NULL, 'home', NULL, NULL, 'female', 3.6, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'SEEDQR00013', NULL, 'none', NULL, NULL, NULL),
  (14, 'Zeus',  'perro', 'Criollo',  'Gris',   'Medellín', NULL, 'home', NULL, NULL, 'male', 19.0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'SEEDQR00014', NULL, 'none', NULL, NULL, NULL),
  (15, 'Milo',  'gato',  'Criollo',  'Negro',  'Cali', NULL, 'home', NULL, NULL, 'male', 4.0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'SEEDQR00015', NULL, 'none', NULL, NULL, NULL),
  (16, 'Sasha', 'perro', 'Criollo',  'Blanco', 'Bogotá', NULL, 'home', NULL, NULL, 'female', 10.0, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'SEEDQR00016', NULL, 'none', NULL, NULL, NULL),
  (17, 'Duke',  'perro', 'Criollo',  'Café',   'Bogotá', NULL, 'home', NULL, NULL, 'male', 14.0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'SEEDQR00017', NULL, 'none', NULL, NULL, NULL),
  (18, 'Nina',  'gato',  'Criollo',  'Gris',   'Bogotá', NULL, 'home', NULL, NULL, 'female', 3.7, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'SEEDQR00018', NULL, 'none', NULL, NULL, NULL),
  (19, 'Chispa','perro', 'Criollo',  'Negro',  'Barranquilla', NULL, 'home', NULL, NULL, 'female', 11.0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'SEEDQR00019', NULL, 'none', NULL, NULL, NULL),
  (20, 'Tina',  'gato',  'Criollo',  'Blanco', 'Bogotá', NULL, 'home', NULL, NULL, 'female', 3.2, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'SEEDQR00020', NULL, 'none', NULL, NULL, NULL);

-- Blog posts: 6 posts across a few users
INSERT INTO blog_posts (author_id, title, slug, excerpt, content, cover_image_url, status, published_at)
VALUES
  (1, 'Cómo cuidar a tu perro en Bogotá', 'cuidar-perro-bogota', 'Consejos prácticos para el clima y la ciudad.', 'Contenido demo...', NULL, 'published', NOW()),
  (3, 'Alimentación de gatos criollos', 'alimentacion-gatos-criollos', 'Guía básica de alimentación.', 'Contenido demo...', NULL, 'published', NOW()),
  (8, 'Paseos seguros en parques', 'paseos-seguros-parques', 'Checklist para paseos tranquilos.', 'Contenido demo...', NULL, 'published', NOW()),
  (11,'Vacunación al día', 'vacunacion-al-dia', 'Importancia del esquema de vacunación.', 'Contenido demo...', NULL, 'published', NOW()),
  (13,'Socialización de cachorros', 'socializacion-cachorros', 'Tips iniciales.', 'Contenido demo...', NULL, 'published', NOW()),
  (16,'Cuidados para gatos senior', 'cuidados-gatos-senior', 'Atención especial.', 'Contenido demo...', NULL, 'published', NOW());

-- Classifieds: 10 items across various users
INSERT INTO classifieds (user_id, title, category, condition, description, price_cents, currency, city, photo_url, status)
VALUES
  (2,  'Transportadora plástica', 'Transporte', 'buen_estado', 'Transportadora pequeña en buen estado.', 95000, 'COP', 'Medellín', NULL, 'active'),
  (4,  'Cama para perro talla M', 'Accesorios', 'como_nuevo', 'Lavable, casi nueva.', 120000, 'COP', 'Bogotá', NULL, 'active'),
  (5,  'Rascador para gato', 'Accesorios', 'buen_estado', 'Sisal y base estable.', 80000, 'COP', 'Bogotá', NULL, 'active'),
  (7,  'Plato doble de acero', 'Accesorios', 'como_nuevo', 'Antideslizante.', 40000, 'COP', 'Bucaramanga', NULL, 'active'),
  (9,  'Juguete mordedor', 'Juguetes', 'nuevo', 'Resistente para perros medianos.', 30000, 'COP', 'Medellín', NULL, 'active'),
  (10, 'Impermeable talla S', 'Ropa', 'buen_estado', 'Para perro pequeño.', 60000, 'COP', 'Cali', NULL, 'active'),
  (12, 'Comedero automático', 'Accesorios', 'buen_estado', 'Con temporizador.', 180000, 'COP', 'Bogotá', NULL, 'active'),
  (14, 'Arnés con correa', 'Accesorios', 'usado', 'Funcional y ajustable.', 25000, 'COP', 'Medellín', NULL, 'active'),
  (18, 'Cortaúñas profesional', 'Higiene', 'nuevo', 'Con tope de seguridad.', 28000, 'COP', 'Bogotá', NULL, 'active'),
  (20, 'Caja de arena con tapa', 'Higiene', 'como_nuevo', 'Apenas usada.', 70000, 'COP', 'Bogotá', NULL, 'active');

-- BnB sitters: 10 in Bogotá with geo, services, price, hours
SET @city := 'Bogotá';
SET @currency := 'COP';
INSERT INTO bnb_sitters (user_id, name, bio, city, lat, lng, address, pet_types, hours_json, services, price_cents, currency, experience_years, photo_url, rating, reviews_count, active)
VALUES
  (1,  'Hogar Pet Bogotá 1', 'Cuidado amoroso para perros y gatos.', @city, 4.7110, -74.0721, 'Cra 7 #10-20', 'perro,gato', '{"mon":["08:00-18:00"],"sat":["09:00-13:00"]}', 'boarding,walking,daycare', 45000, @currency, 3, NULL, 4.8, 23, 1),
  (4,  'Hogar Pet Bogotá 2', 'Experiencia con perros senior.', @city, 4.7105, -74.0715, 'Cll 72 #15-33', 'perro', '{"mon":["08:00-20:00"],"sun":["10:00-14:00"]}', 'boarding,daycare', 50000, @currency, 5, NULL, 4.6, 12, 1),
  (5,  'Hogar Pet Bogotá 3', 'Paseos diarios y cuidado en casa.', @city, 4.7109, -74.0709, 'Av 19 #100-05', 'perro,gato', '{"mon":["07:00-19:00"],"sat":["09:00-12:00"]}', 'walking,daycare', 30000, @currency, 2, NULL, 4.5, 9, 1), 
  (8,  'Hogar Pet Bogotá 4', 'Amplio apartamento, sin niños.', @city, 4.7102, -74.0727, 'Cll 26 #68-80', 'gato', '{"mon":["09:00-18:00"],"fri":["09:00-16:00"]}', 'boarding', 40000, @currency, 4, NULL, 4.9, 44, 1),
  (11, 'Hogar Pet Bogotá 5', 'Patio cercado y cámaras.', @city, 4.7113, -74.0718, 'Cra 30 #45-12', 'perro', '{"mon":["06:30-18:30"],"sat":["08:00-12:00"]}', 'boarding,walking', 55000, @currency, 6, NULL, 4.7, 31, 1),
  (12, 'Hogar Pet Bogotá 6', 'Cuidado especializado post-operatorio.', @city, 4.7118, -74.0730, 'Cll 45 #20-90', 'perro,gato', '{"mon":["08:00-18:00"],"sun":["10:00-14:00"]}', 'daycare', 35000, @currency, 3, NULL, 4.4, 8, 1),
  (13, 'Hogar Pet Bogotá 7', 'Educador canino certificado.', @city, 4.7122, -74.0712, 'Cra 13 #85-30', 'perro', '{"mon":["08:00-20:00"],"sat":["09:00-13:00"]}', 'walking,daycare', 38000, @currency, 5, NULL, 4.6, 27, 1),
  (16, 'Hogar Pet Bogotá 8', 'Ambiente tranquilo para gatos.', @city, 4.7116, -74.0702, 'Cll 90 #14-18', 'gato', '{"mon":["09:00-18:00"],"sun":["10:00-12:00"]}', 'boarding', 42000, @currency, 4, NULL, 4.8, 19, 1),
  (17, 'Hogar Pet Bogotá 9', 'Zona verde cercana para paseos.', @city, 4.7108, -74.0733, 'Av 68 #80-10', 'perro', '{"mon":["07:00-19:00"],"fri":["07:00-17:00"]}', 'walking,daycare,boarding', 48000, @currency, 4, NULL, 4.5, 22, 1),
  (18, 'Hogar Pet Bogotá 10', 'Experiencia con razas pequeñas.', @city, 4.7101, -74.0705, 'Cra 11 #82-05', 'perro,gato', '{"mon":["08:00-18:00"],"sat":["09:00-13:00"]}', 'daycare,boarding', 37000, @currency, 3, NULL, 4.6, 15, 1);

COMMIT;
