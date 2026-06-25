import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/app/lib/auth';
import { findOrderById, setOrderStatusIfNew } from '@/app/lib/orders';
import { sendOrderConfirmedEmail, sendOrderCancelledEmail } from '@/app/lib/email';

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id, status } = await req.json();
  if (!id || (status !== 'confirmed' && status !== 'cancelled')) {
    return NextResponse.json({ error: 'Neplatný požadavek.' }, { status: 400 });
  }

  const order = await findOrderById(id);
  if (!order) {
    return NextResponse.json({ error: 'Objednávka nenalezena.' }, { status: 404 });
  }

  // Potvrdit/zrušit lze jen objednávku ve stavu 'new'. Atomický přechod brání
  // duplicitním e-mailům při souběhu i nepovoleným přechodům (např. potvrzení
  // už zrušené objednávky ze zastaralé stránky). E-mail jde jen při skutečné změně.
  if (order.status !== 'new') {
    return NextResponse.json({ ok: true });
  }

  const changed = await setOrderStatusIfNew(id, status, 'admin');
  if (!changed) {
    return NextResponse.json({ ok: true });
  }

  try {
    if (status === 'confirmed') {
      await sendOrderConfirmedEmail({ ...order, status });
    } else {
      await sendOrderCancelledEmail({ ...order, status });
    }
  } catch (err) {
    console.error('Order status email failed:', err);
  }

  return NextResponse.json({ ok: true });
}
