import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/app/lib/auth';
import { loadOrders } from '@/app/lib/orders';

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const date = req.nextUrl.searchParams.get('date');
  if (!date) {
    return NextResponse.json({ error: 'Parametr date je povinný.' }, { status: 400 });
  }

  const orders = await loadOrders();
  const filtered = orders
    .filter((o) => o.date === date)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return NextResponse.json({ orders: filtered });
}
