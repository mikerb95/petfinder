import Link from 'next/link';

const products = [
  { slug: 'collar-qr-s', name: 'Collar QR Talla S', price: 45000 },
  { slug: 'collar-qr-m', name: 'Collar QR Talla M', price: 49000 },
  { slug: 'collar-qr-l', name: 'Collar QR Talla L', price: 52000 },
];

export default function Page() {
  return (
    <div>
      <h1 style={{ marginBottom: 8 }}>Tienda</h1>
      <p style={{ color: '#9ca3af', marginTop: 0 }}>Collares con código QR/NFC para mascotas.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {products.map((p) => (
          <article key={p.slug} style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 14 }}>
            <div style={{ height: 140, background: 'rgba(255,255,255,0.06)', borderRadius: 10, marginBottom: 10, display: 'grid', placeItems: 'center' }}>📦</div>
            <h3 style={{ margin: '0 0 6px' }}>{p.name}</h3>
            <div style={{ color: '#9ca3af', marginBottom: 10 }}>COP {p.price.toLocaleString('es-CO')}</div>
            <Link href={`/shop/${p.slug}`} style={{ color: '#0ea5e9' }}>Ver detalle</Link>
          </article>
        ))}
      </div>
    </div>
  );
}
