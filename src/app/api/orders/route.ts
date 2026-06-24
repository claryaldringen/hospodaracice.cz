import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createOrder } from '@/app/lib/orders';
import { sendOrderNotification } from '@/app/lib/email';
import { query } from '@/app/lib/db';
import type { OrderItem, Order } from '@/app/types';

async function loadVillages(): Promise<string[]> {
  const rows = await query<{ name: string }>('SELECT name FROM delivery_villages ORDER BY name');
  return rows.map((r) => r.name);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, phone, address, village, note, day, date, items } = body;

  if (!name || !email || !phone || !address || !village || !day || !date) {
    return NextResponse.json({ error: 'Vyplňte všechna povinná pole.' }, { status: 400 });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Vyberte alespoň jedno jídlo.' }, { status: 400 });
  }

  const villages = await loadVillages();
  if (villages.length > 0 && !villages.includes(village)) {
    return NextResponse.json({ error: 'Neplatná obec.' }, { status: 400 });
  }

  const order: Order = {
    id: randomUUID(),
    name,
    email,
    phone,
    address,
    village,
    note: note || undefined,
    day,
    date,
    items: items as OrderItem[],
    status: 'new',
    token: randomUUID(),
    createdAt: new Date().toISOString(),
  };

  await createOrder(order);

  try {
    await sendOrderNotification(order);
  } catch (err) {
    console.error('Order notification email failed:', err);
  }

  return NextResponse.json({ ok: true });
}
