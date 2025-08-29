import Link from 'next/link';

const catalog: Record<string, { name: string; price: number; desc: string }> = {
  'collar-qr-s': { name: 'Collar QR Talla S', price: 45000, desc: 'Collar ligero para mascotas pequeñas con QR resistente.' },
  'collar-qr-m': { name: 'Collar QR Talla M', price: 49000, desc: 'Collar versátil para razas medianas con QR impreso.' },
  'collar-qr-l': { name: 'Collar QR Talla L', price: 52000, desc: 'Collar robusto para razas grandes con QR/NFC opcional.' },
};

export default function ProductPage({ params }: { params: { slug: string } }) {
  const p = catalog[params.slug];
  if (!p) {
    return (
      <div>
        <h1>Producto no encontrado</h1>
        <p>
          <Link href="/shop">Volver a la tienda</Link>
        </p>
      </div>
    );
  }
  return (
    <div>
      <p>
        <Link href="/shop" style={{ color: '#0ea5e9' }}>
          ← Volver
        </Link>
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ height: 260, background: 'rgba(255,255,255,0.06)', borderRadius: 12, display: 'grid', placeItems: 'center' }}>🛍️</div>
        <div>
          <h1 style={{ margin: '0 0 8px' }}>{p.name}</h1>
          <div style={{ color: '#9ca3af', marginBottom: 10 }}>COP {p.price.toLocaleString('es-CO')}</div>
          <p style={{ color: '#cbd5e1' }}>{p.desc}</p>
          <form action="/shop/api/checkout" method="post">
            <input type="hidden" name="slug" value={params.slug} />
            <button style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)' }} type="submit">Comprar</button>
          </form>
        </div>
      </div>
    </div>
  );
}
