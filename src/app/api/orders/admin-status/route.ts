import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/app/lib/auth';
import { findOrderById, updateOrderStatus } from '@/app/lib/orders';
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

  if (order.status === status) {
    return NextResponse.json({ ok: true });
  }

  await updateOrderStatus(id, status);

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
