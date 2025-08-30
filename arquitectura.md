# Arquitectura de Software — Petfinder (documento completo)

Fecha: 2025-08-29

## 1. Resumen ejecutivo
Petfinder es una plataforma web integral para el ecosistema de mascotas que abarca: identificación con QR, adopciones, clasificados, PetBnB (cuidadores), blog, y tienda con carrito/checkout/pagos simulados. Combina un frontend estático (HTML/CSS/JS) con un backend Express y una base de datos MySQL, orientado a despliegue serverless en Vercel y ejecución local. La autenticación usa JWT; las contraseñas se protegen con bcrypt. La base de datos tiene un esquema unificado y datos de demostración separados.

Dominios cubiertos:
- Identificación y salud de mascotas: QR/NFC, ficha pública, historial básico (check-ins), reportes de pérdida.
- Adopciones: listado público y publicación por parte de dueños.
- Clasificados: compra/venta entre usuarios (listado público y gestión privada).
- PetBnB: cuidadores (sitters) con servicios en español y reservas.
- Blog: posts, categorías, tags, comentarios con hilos, reacciones, y moderación admin.
- Tienda: productos y variantes, inventario, carrito, checkout, órdenes, pagos (simulados), cupones, direcciones, e inventario.

## 2. Objetivos de la arquitectura
- Experiencia pública sin fricción (QR, adopciones, blog, tienda) y panel seguro para propietarios/creadores.
- Separación clara de esquema vs. datos de demo (seed) y reforzamiento de integridad (FKs, índices).
- Despliegue simple y escalable (Vercel) con compatibilidad local.
- Base tecnológica estándar y auditable (Express/MySQL/JS), minimizando dependencias.

## 3. Mapa de componentes
- Cliente Web (public/): HTML, CSS, JS nativo; páginas para QR, blog, tienda, PetBnB, clasificados, dashboard.
- API Backend (src/): Express + mysql2, endpoints REST por dominio, middlewares de auth y admin.
- Base de Datos (sql/): MySQL con `schema.sql` (solo DDL) y `seed_demo_data.sql` (solo datos de demo).
- Integraciones: generación de QR (qrcode), email opcional vía Resend (contacto), despliegue Vercel (api/index.js).

Diagrama textual de interacción (alto nivel):
Navegador ⇄ Express API ⇄ MySQL
           ⇅ estáticos
  public/ assets
           ⇄ QR (qrcode)
           ⇄ Resend (opcional)

## 4. Estructura del repositorio
- `public/` páginas estáticas: `index.html`, `login.html`, `register.html`, `dashboard.html`, `pet.html`, `scan.html`, `adopt.html`, `classifieds.html`, `bnb.html`, `blog.html`, `blog_post.html`, `blog_editor.html`, `shop.html`, `shop_product.html`, `cart.html`, `checkout.html`, `payment.html`, `order_confirmed.html`, `order_lookup.html`, `privacy.html`, `terms.html`, `tech.html`, `admin-products.html`, `admin-blog.html`, y assets.
- `src/`
  - `app.js`: API principal (todas las rutas) y mapeo de páginas.
  - `server.js`: arranque local.
  - `config.js`: variables de entorno y defaults.
  - `db.js`: creación y obtención de pool MySQL.
  - `routes/auth.js`: registro/login.
  - `middleware/auth.js`: `requireAuth`.
  - `middleware/admin.js`: `requireAdmin`.
  - `utils/id.js`: generador de IDs aleatorios.
- `api/index.js`: adaptador Express para runtimes serverless (Vercel).
- `sql/schema.sql`: esquema unificado (sin datos).
- `sql/seed_demo_data.sql`: datos de demostración consolidados.
- `scripts/`: utilidades (`db-init.js`, migraciones, smoke tests).
- `old/`: artefactos de una versión Java (archivados, no activos).

## 5. Tecnologías clave
- Node.js >= 18, Express 4.x, mysql2 (promesas), jsonwebtoken, bcryptjs, qrcode, dotenv, Resend (opcional).
- Vercel para serverless, vercel.json para enrutamiento, `@vercel/analytics` opcional.

## 6. Diseño del backend (Express)
Middleware y utilidades relevantes:
- estáticos: `express.static(public/)` con extensiones `.html`.
- JSON parser: `express.json()`.
- Autenticación: `requireAuth` (JWT en header Authorization) y `requireAdmin`.
- Sesión de carrito: cookie propia `pf_cart` (HttpOnly; SameSite=Lax; Max-Age predefinido) sin backend de sesión.

Dominios y endpoints (principales):
- Salud: `/api/health`, `/api/db/health`.
- Auth: `/api/auth/register`, `/api/auth/login`, y util dev `/api/admin/dev/promote` (no prod).
- Perfil: `/api/me` GET/PUT.
- Mascotas: `/api/pets` GET/POST, `/api/pets/:id` PUT/DELETE, fotos (`/api/pets/:id/photos`), checkins (`/api/pets/:id/checkins`).
- Adopciones: público `/api/adoptions`, propietario `/api/me/adoptions` (GET/POST/PUT), transferencia `/api/pets/:id/transfer`.
- Reportes de pérdida: `/api/pets/:id/lost-reports` POST, `/api/lost-reports/:reportId` PATCH.
- QR/NFC: `/api/qr/pet/:qrId.svg|.png`, pública `/api/pets/public/:qrId`, redirección NFC `/n/:nfcId`.
- Tienda: público `/api/shop/products`, detalle `/api/shop/products/:slug`.
- Carrito/Checkout: `/api/cart` GET/POST/PUT/DELETE; órdenes `/api/shop/orders` (crear), `/api/checkout` (checkout desde carrito), `/api/payment/:orderId` GET/POST, lookup `/api/orders/lookup`, simulación `/api/shop/payments/simulate` (solo dev).
- Admin productos: `/api/admin/products` GET/POST, `/api/admin/products/:id` PUT/DELETE.
- Blog: posts `/api/blog/posts` GET/POST; por slug `/api/blog/posts/:slug` GET; por id (editor) `/api/blog/posts/id/:id` GET/PUT; comentarios `/api/blog/posts/:slug/comments` GET/POST; reacciones a posts y comentarios; counters.
- Admin blog: categorías `/api/admin/blog/categories` CRUD; tags `/api/admin/blog/tags` CRUD; moderación de comentarios `/api/admin/blog/comments` GET/PATCH/DELETE.
- Clasificados: público `/api/classifieds` + detalle `/api/classifieds/:id`; gestión del usuario `/api/me/classifieds` (GET/POST/PUT/DELETE por id).
- PetBnB: listado público de sitters `/api/bnb/sitters`, reservas `/api/bnb/bookings` (auth).
- Contacto: `/api/contact` (envío por Resend si configurado en producción).

Páginas servidas por Express (mapeo a `public/`): `/`, `/login`, `/register`, `/forgot`, `/reset`, `/dashboard`, `/admin/products`, `/admin/blog`, `/scan`, `/m`, `/shop`, `/shop/:slug`, `/cart`, `/checkout`, `/payment`, `/order_confirmed`, `/order_lookup`, `/tech`, `/kickoff`, `/bnb`, `/contact`, `/terms`, `/privacy`, `/adopt`, `/blog`, `/blog/editor`, `/blog/:slug`, `/p/:qrId`.

Estrategia de errores: respuestas JSON con `error`, códigos 4xx para validaciones y 5xx en fallos internos. En no-producción, algunos endpoints adjuntan `detail`/`code` para depuración.

## 7. Modelo de datos (MySQL)
Esquema unificado en `sql/schema.sql` con claves foráneas e índices. Principales tablas por dominio:

Usuarios y perfil
- `users` (id, name, last_name, sex, email UNIQUE, password_hash, phone, city, redes sociales, is_admin, created_at, ...)

Mascotas y salud
- `pets` (id, owner_id FK users, name, species, breed, color, city, notes, status ['home','lost'], photo_url, birthdate, sex, weight_kg, sterilized, microchip_id, alergias, condiciones, medicamentos, last_vet_visit, vet_clinic_name/phone, vaccine_card_url, qr_id UNIQUE, nfc_id UNIQUE NULL, adoption_* campos, created_at/updated_at)
- `pet_photos` (id, pet_id FK, photo_url, uploaded_at)
- `pet_checkins` (id, pet_id FK, user_id FK, location, notes, created_at)
- `lost_reports` (id, pet_id FK, reporter_id FK, last_seen_location, notes, status ['active','found','closed'], created_at/updated_at)
- `adoptions` (id, pet_id FK, adopter_id FK, adoption_date, notes)

Tienda e Inventario
- `products` (id, name, slug UNIQUE, price_cents, currency, stock, active, image_url, description, sku, created_at/updated_at)
- `product_variants` (id, product_id FK, name, size, color, price_cents, stock, sku)
- `inventory_movements` (id, product_id/variant_id, change_qty, reason, reference, created_at)
- `carts` (id, session_id UNIQUE, created_at)
- `cart_items` (id, cart_id FK, product_id FK, variant_id FK NULL, quantity, unit_price_cents, currency, added_at)
- `addresses` (id, user_id NULL FK, full_name, line1/line2, city, region, postal_code, country_code, phone)
- `coupons` (id, code UNIQUE, type ['percent','fixed'], percent_off, amount_off_cents, currency, starts_at, ends_at, active, max_redemptions, usage_count)
- `orders` (id, order_number UNIQUE, user_id NULL FK, email, phone, billing_address_id FK, shipping_address_id FK, status ['pending','paid','cancelled'], currency, subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents, coupon_id FK NULL, notes, created_at/updated_at)
- `order_items` (id, order_id FK, product_id FK, variant_id FK, name, sku, unit_price_cents, quantity, total_cents)
- `payments` (id, order_id FK, provider, status ['pending','succeeded','failed'], amount_cents, currency, created_at/updated_at)

Blog y Comunidad
- `blog_posts` (id, author_id FK users, title, slug UNIQUE, excerpt, content, cover_image_url, status ['draft','published','archived'], published_at, created_at/updated_at)
- `blog_comments` (id, post_id FK, user_id FK, parent_id self-FK NULL, body, status ['visible','pending','hidden','deleted'], created_at)
- `blog_post_reactions` (id, post_id FK, user_id FK UNIQUE(post_id,user_id), reaction ['up','down'])
- `blog_comment_reactions` (id, comment_id FK, user_id FK UNIQUE(comment_id,user_id), reaction ['up','down'])
- `blog_categories`, `blog_tags` (id, name, slug UNIQUE...)
- `blog_post_categories` (post_id FK, category_id FK, UNIQUE)
- `blog_post_tags` (post_id FK, tag_id FK, UNIQUE)

Clasificados
- `classifieds` (id, user_id FK, title, category, `condition` ['nuevo','como_nuevo','buen_estado','usado'], description, price_cents, currency, city, photo_url, status ['active','sold','hidden'], views, created_at/updated_at)

PetBnB
- `bnb_sitters` (id, name, city, lat, lng, address, pet_types CSV, hours_json, services CSV con slugs en español: 'hospedaje','paseo','guarderia_diurna','entrenamiento', etc.; price_cents, currency, experience_years, photo_url, rating, reviews_count, active)
- `bnb_bookings` (id, owner_id FK users, sitter_id FK, start_date, end_date, status ['pending','confirmed','cancelled','completed'], notes, created_at/updated_at)

Índices y FKs
- Claves foráneas en relaciones 1:N con `ON DELETE` razonable (normalmente restrict o cascade según aplica) e índices sobre claves externas y filtros frecuentes (slugs, status, created_at, order_number, qr_id, session_id, ...).

## 8. Datos de demostración (seed)
- Archivo único `sql/seed_demo_data.sql` con: 20 usuarios (hash bcrypt real común para demo), 20 mascotas (2 en adopción), 10 anuncios de clasificados, 10 cuidadores en Bogotá, 6+ posts de blog con categorías/tags, productos demo (tienda), servicios de PetBnB traducidos a español. Separado del esquema.

## 9. Seguridad y cumplimiento
- Contraseñas: `bcryptjs` con costo 10. No se almacenan en claro.
- Auth: JWT firmado con secreto de entorno; validación en `requireAuth`. Campo `is_admin` para controles de admin.
- SQL: consultas parametrizadas con mysql2; mitigación de inyección.
- Cookies: `pf_cart` con HttpOnly y SameSite=Lax. En prod se recomienda `Secure` sobre HTTPS.
- Exposición pública mínima: `/api/pets/public/:qrId` retorna solo los datos necesarios.
- Validaciones de entrada: presentes en endpoints principales (tipos, enums, rangos). Puede reforzarse.
- CORS: por defecto mismo origen; habilitar de ser necesario.
- Trazas: logs por consola; en prod, agregar plataforma de logs.

## 10. Frontend (páginas clave)
- `dashboard.html`: perfil, mascotas (CRUD), adopciones, clasificados (botón Vender), pedidos, etc.
- `classifieds.html`: listado público con búsqueda/filtros.
- `bnb.html`: buscador de cuidadores por ciudad/servicio (slugs en español).
- `blog.html`/`blog_post.html`/`blog_editor.html`: contenido y creación de posts; comentarios con hilos.
- `shop.html`/`shop_product.html`/`cart.html`/`checkout.html`/`payment.html`/`order_confirmed.html`/`order_lookup.html`: flujo de tienda.
- `pet.html` y `scan.html`: ficha pública y escaneo QR.

## 11. Despliegue y operaciones
- Local: `npm start` (Node 18+). Variables en `.env`.
- Vercel: `vercel.json` define routing; `api/index.js` expone Express como serverless. Analytics opcional.
- Salud: `/api/health` (sin DB), `/api/db/health` (con DB).
- Scripts: `scripts/db-init.js`, migraciones puntuales, smoke tests (`smoke-ids.js`, `smoke-routes.js`).

## 12. Variables de entorno
- `APP_BASE_URL`, `PORT` (local), `JWT_SECRET`.
- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_SSL`.
- `RESEND_API_KEY`, `FROM_EMAIL`, `CONTACT_TO` (opcional para contacto en prod).
- `DEV_ADMIN_KEY` (solo desarrollo, para promover admin temporalmente).

## 13. Calidad, pruebas y validación
- Build: proyecto Node puro; sin transpilado.
- Lint/Typecheck: no configurado por simplicidad académica.
- Tests: smoke scripts para IDs/rutas; endpoints dev para simulación de pagos.
- Verificaciones manuales sugeridas: CRUD de mascotas, flujo QR, adopciones, clasificados (crear/editar/buscar), PetBnB (listar/reservar), blog (post/comentarios/reacciones), tienda (carrito/checkout/pago simulado).

## 14. Rendimiento y escalabilidad
- Pool de conexiones MySQL y uso de índices en claves de consulta.
- Recursos estáticos servidos por CDN de Vercel.
- Opciones de escalado: caché HTTP para listados públicos (ej. `/api/classifieds`, `/api/bnb/sitters`, `/api/blog/posts`), rate limiting y circuit breakers.
- Trabajo futuro: colas para procesos largos (emails/batch), y almacenamiento de medios externo.

## 15. Decisiones y convenciones
- Separación Esquema/Seed: `schema.sql` sin datos; `seed_demo_data.sql` solo demo.
- Slugs en español para PetBnB: p. ej., `hospedaje`, `paseo`, `guarderia_diurna`.
- Tablas con `created_at/updated_at` y enums controlados por aplicación.
- Nombres de rutas y mensajes de error en español para consistencia.

## 16. Limitaciones y riesgos conocidos
- Sin refresco de tokens ni logout server-side.
- Carrito basado en cookie de sesión simple (sin expiración lado-servidor).
- Sin rate limiting ni Helmet por defecto.
- No hay subida de archivos; URLs de imagen externas.

## 17. Guía de inicio (DB y datos demo)
1) Crear base de datos MySQL y configurar `.env`.
2) Ejecutar `sql/schema.sql` (DDL) para crear tablas e índices.
3) Cargar `sql/seed_demo_data.sql` para datos de demo (usuarios/mascotas/blog/tienda/clasificados/PetBnB).
4) Arrancar API: `npm start`. Visitar `/` y explorar.

## 18. Próximos pasos y mejoras sugeridas
- Seguridad: Helmet, rate limiting, auditoría de inputs, CORS configurable por entorno.
- Observabilidad: logs estructurados, trazas, métricas básicas (p95 latencia por endpoint).
- UX: paginación y facets, subida de imágenes, i18n completa, accesibilidad.
- Pagos: integrar pasarela real y webhooks.
- Pruebas: suites unitarias e integración, CI en PRs.

—
Este documento describe el estado actual del proyecto Petfinder en este repositorio, cubriendo arquitectura, dominios, API, datos y operación, con foco en claridad, seguridad básica y mantenibilidad.
