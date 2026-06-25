import { query, queryOne } from './db';
import type { Order } from '@/app/types';

interface OrderRow {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  address: string;
  village: string;
  note: string | null;
  day: string;
  date: string;
  items: unknown;
  status: string;
  token: string | null;
  created_at: Date;
  status_changed_at: Date | null;
  status_source: string | null;
}

function mapRow(row: OrderRow): Order {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? '',
    phone: row.phone,
    address: row.address,
    village: row.village,
    note: row.note ?? undefined,
    day: row.day,
    date: row.date,
    items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
    status: row.status as Order['status'],
    token: row.token ?? '',
    statusChangedAt: row.status_changed_at ? row.status_changed_at.toISOString() : null,
    statusSource: (row.status_source as Order['statusSource']) ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function createOrder(order: Order): Promise<void> {
  await query(
    `INSERT INTO orders (id, name, email, phone, address, village, note, day, date, items, status, token, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      order.id,
      order.name,
      order.email,
      order.phone,
      order.address,
      order.village,
      order.note ?? null,
      order.day,
      order.date,
      JSON.stringify(order.items),
      order.status,
      order.token,
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

export async function findOrderById(id: string): Promise<Order | null> {
  const row = await queryOne<OrderRow>('SELECT * FROM orders WHERE id = $1', [id]);
  return row ? mapRow(row) : null;
}

export async function findOrderByToken(token: string): Promise<Order | null> {
  const row = await queryOne<OrderRow>('SELECT * FROM orders WHERE token = $1', [token]);
  return row ? mapRow(row) : null;
}

// Atomicky změní stav objednávky pouze pokud je dosud 'new'. Zapíše i čas změny
// a zdroj ('email' z potvrzovacího odkazu, 'admin' z admin panelu). Vrací true,
// když k přechodu skutečně došlo (tj. tento požadavek vyhrál). Brání duplicitním
// e-mailům při race i nepovoleným přechodům.
export async function setOrderStatusIfNew(
  id: string,
  status: Order['status'],
  source: 'email' | 'admin'
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE orders SET status = $1, status_changed_at = NOW(), status_source = $2
     WHERE id = $3 AND status = 'new' RETURNING id`,
    [status, source, id]
  );
  return rows.length > 0;
}
