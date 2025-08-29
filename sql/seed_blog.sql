-- Seed categories and tags
INSERT IGNORE INTO blog_categories (name, slug, description) VALUES
 ('Cuidado', 'cuidado', 'Consejos de cuidado y salud'),
 ('Adiestramiento', 'adiestramiento', 'Entrenamiento y comportamiento');

INSERT IGNORE INTO blog_tags (name, slug) VALUES
 ('perros', 'perros'), ('gatos', 'gatos'), ('salud', 'salud'), ('alimentacion', 'alimentacion'), ('comportamiento', 'comportamiento');

-- Seed posts (author_id nullable)
INSERT INTO blog_posts (author_id, title, slug, excerpt, content, cover_image_url, status, published_at)
VALUES
 (NULL, '10 señales de buena salud en tu perro', 'senales-salud-perro', 'Cómo saber si tu perro está sano.', 'Contenido de ejemplo sobre salud canina.', NULL, 'published', NOW()),
 (NULL, 'Alimentación adecuada para gatos', 'alimentacion-gatos', 'Qué y cuánto debe comer tu gato.', 'Contenido de ejemplo sobre alimentación felina.', NULL, 'published', NOW()),
 (NULL, 'Entrenamiento básico para cachorros', 'entrenamiento-cachorros', 'Primeros pasos de adiestramiento.', 'Contenido de ejemplo sobre entrenamiento de cachorros.', NULL, 'published', NOW()),
 (NULL, 'Cómo identificar el estrés en tu mascota', 'estres-mascotas', 'Señales y qué hacer al respecto.', 'Contenido de ejemplo sobre estrés en mascotas.', NULL, 'published', NOW()),
 (NULL, 'Juegos recomendados para gatos en casa', 'juegos-gatos-casa', 'Ideas para entretener a tu gato.', 'Contenido de ejemplo sobre juegos para gatos.', NULL, 'published', NOW());

-- Map categories/tags to posts
-- Category: Cuidado -> posts 1,2,4
INSERT INTO blog_post_categories (post_id, category_id)
SELECT bp.id, bc.id FROM blog_posts bp, blog_categories bc WHERE bp.slug IN ('senales-salud-perro','alimentacion-gatos','estres-mascotas') AND bc.slug = 'cuidado';
-- Category: Adiestramiento -> post 3
INSERT INTO blog_post_categories (post_id, category_id)
SELECT bp.id, bc.id FROM blog_posts bp, blog_categories bc WHERE bp.slug IN ('entrenamiento-cachorros') AND bc.slug = 'adiestramiento';

-- Tags
INSERT INTO blog_post_tags (post_id, tag_id)
SELECT bp.id, bt.id FROM blog_posts bp, blog_tags bt WHERE bp.slug IN ('senales-salud-perro') AND bt.slug IN ('perros','salud');
INSERT INTO blog_post_tags (post_id, tag_id)
SELECT bp.id, bt.id FROM blog_posts bp, blog_tags bt WHERE bp.slug IN ('alimentacion-gatos') AND bt.slug IN ('gatos','alimentacion');
INSERT INTO blog_post_tags (post_id, tag_id)
SELECT bp.id, bt.id FROM blog_posts bp, blog_tags bt WHERE bp.slug IN ('entrenamiento-cachorros') AND bt.slug IN ('perros','comportamiento');
INSERT INTO blog_post_tags (post_id, tag_id)
SELECT bp.id, bt.id FROM blog_posts bp, blog_tags bt WHERE bp.slug IN ('estres-mascotas') AND bt.slug IN ('perros','gatos','salud');
INSERT INTO blog_post_tags (post_id, tag_id)
SELECT bp.id, bt.id FROM blog_posts bp, blog_tags bt WHERE bp.slug IN ('juegos-gatos-casa') AND bt.slug IN ('gatos','comportamiento');

