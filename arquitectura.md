# Arquitectura de Software — Petfinder

## Resumen ejecutivo
Petfinder es una aplicación web para apoyar la búsqueda de mascotas perdidas mediante códigos QR adheridos al collar. Los dueños registran sus mascotas y generan un QR único; cualquier persona que encuentre la mascota puede escanearlo y acceder a una página pública con datos de contacto, sin necesidad de autenticarse. El proyecto está orientado a fines académicos (SENA) y puede desplegarse en Vercel como arquitectura serverless híbrida.

## Objetivos de la arquitectura
- Separar claramente vistas públicas y funcionalidades de propietario.
- Minimizar fricción para visitantes: acceso público a la ficha por QR sin autenticación.
- Asegurar datos y acciones de propietario mediante autenticación JWT.
- Permitir despliegue sencillo y escalable (serverless en Vercel, compatible con ejecución local).
- Mantener simplicidad técnica con dependencias estándar y fácilmente auditables.

## Visión general de la solución
- Frontend estático (HTML/CSS/JS) servido desde `/public`.
- Backend Node.js con Express sirviendo API REST y algunas páginas estáticas.
- Persistencia en MySQL utilizando `mysql2/promise` con pool de conexiones.
- Generación de códigos QR con la librería `qrcode`.
- Autenticación basada en JWT (`jsonwebtoken`), almacenado en `localStorage` del navegador.
- Despliegue en Vercel con funciones serverless (entry `api/index.js`) y rutas definidas en `vercel.json`.

Estructura relevante del repo:
- `public/` páginas estáticas (index, login, register, dashboard, pet, scan, terms) y assets (CSS/JS).
- `src/` aplicación Express: rutas API, middleware de auth, DB, config, servidor local.
- `api/index.js` adaptador para Vercel serverless que reusa `src/app`.
- `vercel.json` reglas de enrutamiento para páginas públicas y API.

## Componentes y tecnologías
- Lenguaje: Node.js >= 18 (JavaScript, CommonJS).
- Framework web: Express 4.
- Base de datos: MySQL (mysql2/promise; pool de conexiones).
- Auth: JSON Web Tokens (JWT, firmado con `HS256` por defecto en `jsonwebtoken`).
- Criptografía de contraseñas: `bcryptjs` con costo 10.
- Configuración y entorno: `dotenv` y módulo `src/config.js` (APP_BASE_URL, JWT_SECRET, MYSQL_*).
- Códigos QR: `qrcode` (salida PNG y SVG) apuntando a URL público `/p/:qrId`.
- Frontend: HTML5 semántico, CSS personalizado en `assets/css/landing.css`, JavaScript nativo.
- Escaneo QR en cliente: API `BarcodeDetector` cuando está disponible y fallback `jsQR` en `<video>` + `<canvas>`.
- Despliegue: Vercel (serverless) + ejecución local con `node src/server.js`.

## Módulos backend principales
- `src/app.js`:
  - Endpoints de salud (`/api/health`, `/api/db/health`).
  - Autenticación: `/api/auth/login`, `/api/auth/register` (en `src/routes/auth.js`).
  - Perfil autenticado: `/api/me` con middleware `requireAuth`.
  - CRUD de mascotas para el propietario: `/api/pets` (listar), `/api/pets` POST (crear), `/api/pets/:id` PUT/DELETE (actualizar/eliminar) con verificación de propiedad.
  - Vista pública de mascota (JSON): `/api/pets/public/:qrId` con join hacia dueño.
  - Generación de QR: `/api/qr/pet/:qrId.(png|svg)` utilizando `APP_BASE_URL` para construir la URL canónica `/p/:qrId`.
  - Páginas estáticas: `/`, `/login`, `/register`, `/dashboard`, `/scan`, `/p/:qrId`, `/terms`.
- `src/routes/auth.js`:
  - Registro con validaciones básicas y detección de correo duplicado.
  - Login con verificación de hash bcrypt y respuesta de token JWT.
  - Mensajes de error en español.
- `src/middleware/auth.js`:
  - Extracción de token desde header `Authorization: Bearer <token>` y verificación con `JWT_SECRET`.
- `src/db.js`:
  - Creación diferida de pool `mysql2/promise` con `connectionLimit` y soporte opcional SSL.
- `src/config.js`:
  - Carga de `.env` y valores por defecto; `appBaseUrl` para URL absolutas de QR.

## Datos y modelo lógico
Tabla `users` (campos típicos):
- `id` (PK), `name`, `email` (único), `password_hash`, `phone`, `created_at`.

Tabla `pets`:
- `id` (PK), `owner_id` (FK a `users`), `name`, `species`, `breed`, `color`, `notes`, `status` ('home'|'lost'), `photo_url`, `qr_id` (único), `created_at`, `updated_at`.

Relaciones:
- 1:N entre `users` y `pets`.
- `qr_id` permite resolver la página pública `/p/:qrId` y el JSON `/api/pets/public/:qrId`.

## Flujos clave
1) Registro e inicio de sesión
- Register POST `/api/auth/register` -> persiste usuario -> emite JWT.
- Login POST `/api/auth/login` -> valida credenciales -> emite JWT.
- Cliente guarda token en `localStorage` y lo usa en headers.

2) Gestión de mascotas (propietario)
- GET `/api/pets` con JWT -> lista mascotas del usuario.
- POST `/api/pets` -> crea mascota y asigna `qr_id` único (hasta 5 intentos por colisión `ER_DUP_ENTRY`).
- PUT `/api/pets/:id` -> actualiza si es dueño; valida estado permitido.
- DELETE `/api/pets/:id` -> elimina si es dueño.

3) QR y ficha pública
- Imágenes QR: `/api/qr/pet/:qrId.(png|svg)` generadas con la URL absoluta `APP_BASE_URL + /p/:qrId`.
- Página pública `/p/:qrId` (HTML) consume `/api/pets/public/:qrId` y muestra datos mínimos: mascota y contacto del dueño.
- Visitantes no requieren cuenta; dueños sí para editar.

4) Escaneo de QR
- Modal de escaneo en `index.html` y página dedicada `/scan`.
- Usa `navigator.mediaDevices.getUserMedia` y:
  - `BarcodeDetector` (nativo) si está disponible.
  - Fallback `jsQR` con `<canvas>`.
- Extrae token de URL o texto y redirige a `/p/:qrId`.

## Enrutamiento y despliegue
- Vercel `vercel.json`:
  - `^/$` -> `public/index.html` (landing estática).
  - `^/(login|register|scan|terms)$` y `^/dashboard$` -> `api/index.js` (serverless Express).
  - `^/api/(.*)$` -> `api/index.js`.
  - `^/p/(.*)$` -> `api/index.js` (sirve `public/pet.html` desde Express y API pública JSON).
  - Catch-all 404 -> `public/404.html`.
- Local: `npm start` ejecuta `src/server.js` con Express tradicional.

## Seguridad
- Hash de contraseñas con `bcryptjs` (coste 10, configurable).
- JWT expira en 7 días; se recomienda rotación y almacenamiento seguro del secreto (`JWT_SECRET`).
- CORS: por defecto mismo origen; si se expone públicamente con dominios adicionales, agregar middleware CORS.
- Validaciones básicas de entrada en API; se puede reforzar con validadores y rate limiting.
- Datos públicos mínimos en ficha; control del dueño desde dashboard.

## Configuración y entornos
Variables de entorno (archivo `.env` y Vercel Project Settings):
- `APP_BASE_URL` (ej. `https://tu-dominio.vercel.app`), usado para QR.
- `JWT_SECRET` (requerido en prod).
- `PORT` (local).
- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_SSL`.

## Estilos y UI
- `public/assets/css/landing.css`: diseño base, variables CSS, layout responsive (grid y flex), cabecera sticky y componentes (botones, formularios, tarjetas).
- Páginas: `index.html` (landing y modal de escaneo), `login.html`, `register.html` (selector de código de país), `dashboard.html` (perfil, CRUD mascotas, modal de edición), `pet.html` (ficha pública con acciones de contacto), `scan.html`, `terms.html`, `404.html`.
- Cabecera y pie centrados y alineados al ancho del contenido por página.

## Librerías y versiones
- express ^4.19
- mysql2 ^3.11
- jsonwebtoken ^9.0
- bcryptjs ^2.4
- dotenv ^16.4
- qrcode ^1.5
- jsQR (desde CDN para fallback de escaneo)

## Decisiones de diseño
- Serverless first: el mismo `src/app.js` sirve para Vercel y para local, simplificando mantenimiento.
- URL absolutas en QR: se usa `APP_BASE_URL` para asegurar que el QR funcione fuera del contexto del sitio.
- Vista pública minimalista: solo datos esenciales de contacto para proteger privacidad.
- Fallback para escaneo: robustez ante navegadores sin `BarcodeDetector`.
- Simplicidad en el frontend: JS nativo sin frameworks para fácil revisión académica.

## Limitaciones y riesgos
- No hay manejo de sesiones de refresco; JWT de 7 días puede requerir renovación manual.
- Falta validación exhaustiva de inputs y sanitización de HTML en notas si se habilita rich-text.
- Sin almacenamiento de imágenes; se usa `photo_url` externo.
- Ausencia de rate limiting y protección anti-abuso.

## Próximos pasos sugeridos
- Política de Tratamiento de Datos y página de Privacidad dedicada.
- Subida de imágenes a almacenamiento (S3 o similar) con verificación de tipo.
- Paginación y búsqueda en mascotas.
- Internacionalización (i18n) de la UI.
- Mejoras de seguridad: rate limiting, helmet, CORS configurable, logs estructurados.
- Tests automatizados (unitarios e integración) y CI/CD.

## Cómo ejecutar y probar
- Local:
  - Crear `.env` con `APP_BASE_URL`, credenciales MySQL y `JWT_SECRET`.
  - Inicializar BD con `npm run db:init` (si aplica) y arrancar con `npm start`.
- Vercel:
  - Configurar variables de entorno en el proyecto.
  - Hacer push a `master` para que se despliegue automáticamente.

## Conclusión
La arquitectura de Petfinder prioriza simplicidad, seguridad básica y experiencia de usuario directa para el caso de uso: dueños gestionan mascotas y QR, visitantes escanean sin fricción. La base en Express/MySQL es conocida y mantenible, y el despliegue en Vercel permite escalar sin complejidad operacional excesiva.
