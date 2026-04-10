import { query } from './db';
import type { Order } from '@/app/types';

interface OrderRow {
  id: string;
  name: string;
  phone: string;
  address: string;
  village: string;
  note: string | null;
  day: string;
  date: string;
  items: unknown;
  created_at: Date;
}

function mapRow(row: OrderRow): Order {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    village: row.village,
    note: row.note ?? undefined,
    day: row.day,
    date: row.date,
    items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
    createdAt: row.created_at.toISOString(),
  };
}

export async function createOrder(order: Order): Promise<void> {
  await query(
    `INSERT INTO orders (id, name, phone, address, village, note, day, date, items, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      order.id,
      order.name,
      order.phone,
      order.address,
      order.village,
      order.note ?? null,
      order.day,
      order.date,
      JSON.stringify(order.items),
      order.createdAt,
    ]
  );
}

export async function getOrdersByDate(date: string): Promise<Order[]> {
  const rows = await query<OrderRow>('SELECT * FROM orders WHERE date = $1 ORDER BY created_at', [
    date,
  ]);
  return rows.map(mapRow);
}
