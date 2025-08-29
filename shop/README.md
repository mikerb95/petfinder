# Petfinder Shop (Next.js)

- App Router con catálogo básico en `/shop`.
- Página de detalle `/shop/[slug]`.
- Endpoint `/shop/api/checkout` (placeholder) listo para integrar con Stripe Checkout.

Correr local (desde `shop/`):
- npm install
- npm run dev

Despliegue: configuraremos vercel.json para rutear `^/shop` a esta app.

Próximo paso: integrar `stripe` y webhook para confirmar órdenes.
