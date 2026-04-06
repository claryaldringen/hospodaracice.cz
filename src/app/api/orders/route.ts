import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { head } from '@vercel/blob';
import { randomUUID } from 'crypto';
import { loadOrders, saveOrders } from '@/app/lib/orders';
import type { OrderItem, Order } from '@/app/types';

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

async function loadVillages(): Promise<string[]> {
  try {
    const blob = await head('delivery-villages.json', { token: BLOB_TOKEN });
    const res = await fetch(blob.url, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return data.villages || [];
    }
  } catch {
    // ignore
  }
  return [];
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, phone, address, village, note, day, date, items } = body;

  if (!name || !phone || !address || !village || !day || !date) {
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
    phone,
    address,
    village,
    note: note || undefined,
    day,
    date,
    items: items as OrderItem[],
    createdAt: new Date().toISOString(),
  };

  const allOrders = await loadOrders();
  allOrders.push(order);
  await saveOrders(allOrders);

  const totalPrice = order.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const orderEmail = process.env.ORDER_EMAIL;
  if (!orderEmail) {
    return NextResponse.json({ error: 'Email pro objednávky není nastaven.' }, { status: 500 });
  }

  const itemsHtml = order.items
    .map(
      (item) =>
        `<tr>
          <td style="padding: 6px 12px;">${item.name}</td>
          <td style="padding: 6px 12px; text-align: center;">${item.quantity}×</td>
          <td style="padding: 6px 12px; text-align: right;">${item.price * item.quantity} Kč</td>
        </tr>`
    )
    .join('');

  try {
    await getResend().emails.send({
      from: 'Hospoda Na Palouku <noreply@resend.dev>',
      to: orderEmail,
      subject: `Nová objednávka — ${name}, ${village}, ${day} ${date}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
          <h2>Nová objednávka</h2>
          <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
            <tr><td style="padding: 6px 12px; font-weight: bold;">Jméno</td><td style="padding: 6px 12px;">${name}</td></tr>
            <tr><td style="padding: 6px 12px; font-weight: bold;">Telefon</td><td style="padding: 6px 12px;">${phone}</td></tr>
            <tr><td style="padding: 6px 12px; font-weight: bold;">Adresa</td><td style="padding: 6px 12px;">${address}, ${village}</td></tr>
            <tr><td style="padding: 6px 12px; font-weight: bold;">Den</td><td style="padding: 6px 12px;">${day} ${date}</td></tr>
            ${note ? `<tr><td style="padding: 6px 12px; font-weight: bold;">Poznámka</td><td style="padding: 6px 12px;">${note}</td></tr>` : ''}
          </table>
          <h3>Objednávka</h3>
          <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
            <tr style="border-bottom: 1px solid #ddd;">
              <th style="padding: 6px 12px; text-align: left;">Jídlo</th>
              <th style="padding: 6px 12px; text-align: center;">Ks</th>
              <th style="padding: 6px 12px; text-align: right;">Cena</th>
            </tr>
            ${itemsHtml}
            <tr style="border-top: 2px solid #333;">
              <td style="padding: 6px 12px; font-weight: bold;" colspan="2">Celkem</td>
              <td style="padding: 6px 12px; text-align: right; font-weight: bold;">${totalPrice} Kč</td>
            </tr>
          </table>
        </div>
      `,
    });
  } catch {
    return NextResponse.json({ error: 'Chyba při odesílání objednávky.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
