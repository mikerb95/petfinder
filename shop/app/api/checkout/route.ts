import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const form = await req.formData();
  const slug = String(form.get('slug') || '');
  // Placeholder: In a next step, map slug->price and create Stripe Checkout Session
  // For now, just echo and simulate success URL
  const successUrl = `/shop?ok=1&item=${encodeURIComponent(slug)}`;
  return NextResponse.redirect(new URL(successUrl, req.url));
}
