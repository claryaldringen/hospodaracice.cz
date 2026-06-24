import { NextRequest, NextResponse } from 'next/server';
import { findOrderByToken, setOrderStatusIfNew } from '@/app/lib/orders';
import { sendOrderConfirmedEmail } from '@/app/lib/email';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(`${BASE_URL}/objednavka/potvrzeno?status=notfound`);
  }

  const order = await findOrderByToken(token);
  if (!order) {
    return NextResponse.redirect(`${BASE_URL}/objednavka/potvrzeno?status=notfound`);
  }

  if (order.status === 'cancelled') {
    return NextResponse.redirect(`${BASE_URL}/objednavka/potvrzeno?status=cancelled`);
  }

  if (order.status === 'confirmed') {
    return NextResponse.redirect(`${BASE_URL}/objednavka/potvrzeno?status=already`);
  }

  // Atomicky potvrď jen pokud je objednávka stále 'new'. Při souběhu
  // (dvojklik / současný admin) vyhraje jeden požadavek a jen ten pošle e-mail.
  const changed = await setOrderStatusIfNew(order.id, 'confirmed');
  if (!changed) {
    return NextResponse.redirect(`${BASE_URL}/objednavka/potvrzeno?status=already`);
  }

  try {
    await sendOrderConfirmedEmail({ ...order, status: 'confirmed' });
  } catch (err) {
    console.error('sendOrderConfirmedEmail failed:', err);
  }

  return NextResponse.redirect(`${BASE_URL}/objednavka/potvrzeno?status=confirmed`);
}
