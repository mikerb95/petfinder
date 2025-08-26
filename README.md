# Petfinder

> Academic context: Project for the Software Architecture subject at SENA (Servicio Nacional de Aprendizaje).

Find lost pets using QR codes attached to their collars. When someone scans a pet’s QR code, they see the owner’s contact info to reach out—no account required for guests.

## Features

- Owner registration and JWT-based login
- Owners register pets and generate a unique QR for each
- Public (guest) view via QR; no login required
- MySQL persistence
- Node.js + Express backend
- Ready to deploy on Vercel serverless

## Tech stack

- Runtime: Node.js
- Web framework: Express
- Auth: JSON Web Tokens (JWT)
- Database: MySQL
- QR codes: Open-source QR library (e.g., `qrcode`)
- Deployment: Vercel

## High-level logic

- Owner user creates an account and logs in.
- Owner registers one or more pets; each pet gets a unique QR ID and URL.
- Anyone who finds a pet scans the QR and sees the owner’s contact details (read-only, no login).

## API outline (initial)

- POST /api/auth/register — create owner account
- POST /api/auth/login — authenticate, returns JWT
- GET /api/pets — list owner’s pets (auth)
- POST /api/pets — create a pet and generate QR (auth)
- GET /p/:qrId — public pet contact view (no auth)

## Environment variables

Create a `.env` file with values like:

```
# App
NODE_ENV=development
PORT=3000
JWT_SECRET=replace-with-a-long-random-secret
APP_BASE_URL=https://your-domain.example  # used in QR deep links

# MySQL
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=petfinder
MYSQL_PASSWORD=petfinder_password
MYSQL_DATABASE=petfinder
```

On Vercel, set these in Project Settings → Environment Variables.

## Database (minimal schema suggestion)

```
-- users (owners)
CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(40),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- pets
CREATE TABLE pets (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  owner_id BIGINT NOT NULL,
  name VARCHAR(120) NOT NULL,
  species VARCHAR(60),
  breed VARCHAR(120),
  color VARCHAR(120),
  qr_id VARCHAR(64) NOT NULL UNIQUE,   -- short code embedded in the QR URL
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);
```

## Suggested project structure

```
src/
  server.ts|js
  routes/
  controllers/
  middleware/
  services/
  db/
  utils/qr.ts|js
public/
```

## Vercel deployment notes

- Use a single Express handler exported for serverless.
- Add environment variables in Vercel.
- Example `vercel.json` (adjust paths as you scaffold the app):

```
{
  "functions": { "api/index.js": { "runtime": "@vercel/node@latest" } },
  "routes": [
    { "src": "/api/(.*)", "dest": "/api/index.js" },
    { "src": "/p/(.*)", "dest": "/api/index.js" }
  ]
}
```

## Next steps

- Scaffold the Node.js + Express app and wire routes.
- Implement JWT auth and owner-only pet management.
- Integrate a QR library to generate codes that point to `/p/:qrId`.
- Add tests and CI, then deploy to Vercel.

---
Open to contributions. Please propose changes via pull request.