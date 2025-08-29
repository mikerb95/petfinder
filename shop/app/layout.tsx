export const metadata = {
  title: 'Tienda — Petfinder',
  description: 'Compra collares con QR/NFC para mascotas.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: 'system-ui, Segoe UI, Roboto, Helvetica, Arial', margin: 0, background: '#0b1220', color: '#e5e7eb' }}>
        <header style={{ position: 'sticky', top: 0, padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(11,18,32,0.7)', backdropFilter: 'blur(6px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1100, margin: '0 auto' }}>
            <a href="/" style={{ color: 'inherit', textDecoration: 'none', fontWeight: 700 }}>🐾 Petfinder</a>
            <nav style={{ display: 'flex', gap: 12 }}>
              <a href="/shop" style={{ color: 'inherit', textDecoration: 'none' }}>Tienda</a>
              <a href="/login" style={{ color: 'inherit', textDecoration: 'none' }}>Ingresar</a>
            </nav>
          </div>
        </header>
        <main style={{ maxWidth: 1100, margin: '0 auto', padding: '20px' }}>{children}</main>
        <footer style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '20px 0', maxWidth: 1100, margin: '0 auto' }}>
          <nav style={{ display: 'flex', gap: 12 }}>
            <a href="/license" style={{ color: '#9ca3af', textDecoration: 'none' }}>Licencia</a>
            <a href="/tech" style={{ color: '#9ca3af', textDecoration: 'none' }}>Detalles técnicos</a>
          </nav>
        </footer>
      </body>
    </html>
  );
}
