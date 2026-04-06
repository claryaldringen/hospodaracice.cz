import { put, head } from '@vercel/blob';
import type { Order } from '@/app/types';

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const FILENAME = 'orders.json';
const CLEANUP_DAYS = 30;

export async function loadOrders(): Promise<Order[]> {
  try {
    const blob = await head(FILENAME, { token: BLOB_TOKEN });
    const res = await fetch(blob.url, { cache: 'no-store' });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function saveOrders(orders: Order[]): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CLEANUP_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const cleaned = orders.filter((o) => o.date >= cutoffStr);

  await put(FILENAME, JSON.stringify(cleaned), {
    access: 'public',
    contentType: 'application/json',
    token: BLOB_TOKEN,
    addRandomSuffix: false,
  });
}
