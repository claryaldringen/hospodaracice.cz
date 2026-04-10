# VPS Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate hospodaracice.cz from Vercel (serverless + Vercel Blob) to Hetzner VPS (standalone Next.js + PostgreSQL + local filesystem).

**Architecture:** Next.js standalone build running under PM2 on port 3002, PostgreSQL 16 for all data, local filesystem for uploads served by Caddy with cache headers. Four domains with one primary (`hospodaracice.cz`) and three 301 redirects.

**Tech Stack:** Next.js 15, PostgreSQL 16, `pg` (node-postgres), PM2, Caddy, local filesystem

**Spec:** `docs/superpowers/specs/2026-04-10-vps-migration-design.md`

---

## File Structure

### New files
- `src/app/lib/db.ts` — PostgreSQL connection pool and query helpers
- `src/app/lib/storage.ts` — Local filesystem operations for uploads
- `db/migrations/001_initial.sql` — Database schema
- `db/migrate.ts` — Migration runner script
- `scripts/deploy.sh` — VPS deploy script
- `scripts/migrate-data.ts` — One-time data migration from Vercel Blob to VPS

### Modified files
- `package.json` — Remove `@vercel/blob`, add `pg` + `@types/pg`
- `next.config.ts` — Add `output: 'standalone'`, remove Vercel remote pattern
- `src/app/lib/reservations.ts` — Rewrite: Blob JSON → PostgreSQL queries
- `src/app/lib/orders.ts` — Rewrite: Blob JSON → PostgreSQL queries
- `src/app/api/upload/route.ts` — Blob `put()` → `fs.writeFile()` + DB for OCR
- `src/app/api/delete/route.ts` — Blob `del()` → `fs.unlink()` + DB cleanup
- `src/app/api/gallery/route.ts` — Blob → filesystem + PostgreSQL
- `src/app/api/opening-hours/route.ts` — Blob JSON → PostgreSQL
- `src/app/api/menu/route.ts` — Blob JSON → PostgreSQL
- `src/app/api/delivery-villages/route.ts` — Blob JSON → PostgreSQL
- `src/app/api/orders/route.ts` — Use new orders lib, DB for villages
- `src/app/api/orders/list/route.ts` — Use new orders lib
- `src/app/api/reservations/route.ts` — Use new reservations lib
- `src/app/api/reservations/availability/route.ts` — Use new reservations lib
- `src/app/api/reservations/confirm/route.ts` — Use new reservations lib
- `src/app/api/reservations/cancel/route.ts` — Use new reservations lib
- `src/app/api/reservations/list/route.ts` — Use new reservations lib
- `src/app/api/reservations/admin-cancel/route.ts` — Use new reservations lib
- `src/app/page.tsx` — Fetch from DB + local filesystem instead of Blob URLs
- `src/app/admin/page.tsx` — Change `BLOB_BASE_URL` → `UPLOADS_URL`

---

## Task 1: Update Dependencies and Next.js Config

**Files:**
- Modify: `package.json`
- Modify: `next.config.ts`

- [ ] **Step 1: Remove @vercel/blob and add pg**

```bash
npm uninstall @vercel/blob
npm install pg
npm install -D @types/pg
```

- [ ] **Step 2: Update next.config.ts**

Replace entire file with:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hospodaracice.cz',
      },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 3: Verify build still compiles (will have import errors — expected)**

```bash
npm run lint
```

Expected: Lint errors for `@vercel/blob` imports. This is fine — we'll fix them in subsequent tasks.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json next.config.ts
git commit -m "chore: replace @vercel/blob with pg, add standalone output"
```

---

## Task 2: Create Database Connection Module

**Files:**
- Create: `src/app/lib/db.ts`

- [ ] **Step 1: Create the db module**

```ts
// src/app/lib/db.ts
import { Pool, type QueryResultRow } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/lib/db.ts
git commit -m "feat: add PostgreSQL connection module"
```

---

## Task 3: Create File Storage Module

**Files:**
- Create: `src/app/lib/storage.ts`

- [ ] **Step 1: Create the storage module**

```ts
// src/app/lib/storage.ts
import { writeFile, unlink, access, mkdir } from 'fs/promises';
import path from 'path';

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');

export function getFilePath(subdir: string, filename: string): string {
  return path.join(UPLOADS_DIR, subdir, filename);
}

export function getPublicUrl(subdir: string, filename: string): string {
  const base = process.env.NEXT_PUBLIC_UPLOADS_URL || '/uploads';
  return `${base}/${subdir}/${filename}`;
}

export async function saveFile(subdir: string, filename: string, data: Buffer): Promise<void> {
  const dir = path.join(UPLOADS_DIR, subdir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), data);
}

export async function deleteFile(subdir: string, filename: string): Promise<void> {
  try {
    await unlink(getFilePath(subdir, filename));
  } catch {
    // File may not exist
  }
}

export async function fileExists(subdir: string, filename: string): Promise<boolean> {
  try {
    await access(getFilePath(subdir, filename));
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/lib/storage.ts
git commit -m "feat: add local filesystem storage module"
```

---

## Task 4: Create SQL Migration

**Files:**
- Create: `db/migrations/001_initial.sql`
- Create: `db/migrate.ts`

- [ ] **Step 1: Create the migration SQL**

```sql
-- db/migrations/001_initial.sql

CREATE TABLE opening_hours (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    text TEXT NOT NULL DEFAULT ''
);
INSERT INTO opening_hours (text) VALUES ('');

CREATE TABLE delivery_villages (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE weekly_menu (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    data JSONB NOT NULL DEFAULT '{"days":[]}'::jsonb
);
INSERT INTO weekly_menu (data) VALUES ('{"days":[]}'::jsonb);

CREATE TABLE menu_images (
    type TEXT PRIMARY KEY,
    full_text TEXT NOT NULL DEFAULT '',
    alt_text TEXT NOT NULL DEFAULT ''
);

CREATE TABLE gallery (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('image', 'video')),
    filename TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reservations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    seats INTEGER NOT NULL,
    date TEXT NOT NULL,
    time_from TEXT NOT NULL,
    time_to TEXT NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reservations_date ON reservations (date);
CREATE INDEX idx_reservations_token ON reservations (token);

CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    village TEXT NOT NULL,
    note TEXT,
    day TEXT NOT NULL,
    date TEXT NOT NULL,
    items JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_date ON orders (date);

-- Track applied migrations
CREATE TABLE _migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 2: Create migration runner**

```ts
// db/migrate.ts
import { Pool } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Ensure _migrations table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const { rows } = await pool.query('SELECT 1 FROM _migrations WHERE name = $1', [file]);
    if (rows.length > 0) {
      console.log(`Skipping ${file} (already applied)`);
      continue;
    }

    console.log(`Applying ${file}...`);
    const sql = readFileSync(path.join(migrationsDir, file), 'utf-8');
    await pool.query(sql);
    await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
    console.log(`Applied ${file}`);
  }

  await pool.end();
  console.log('Migrations complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

- [ ] **Step 3: Add migrate script to package.json**

Add to `scripts` in `package.json`:

```json
"db:migrate": "npx tsx db/migrate.ts"
```

- [ ] **Step 4: Commit**

```bash
git add db/ package.json
git commit -m "feat: add PostgreSQL schema migration"
```

---

## Task 5: Rewrite Reservations Lib for PostgreSQL

**Files:**
- Modify: `src/app/lib/reservations.ts` (full rewrite)

- [ ] **Step 1: Rewrite reservations.ts**

Replace entire file with:

```ts
import { query, queryOne } from './db';
import type { Reservation } from '@/app/types';

const PENDING_TIMEOUT = "30 minutes";

interface ReservationRow {
  id: string;
  name: string;
  email: string;
  seats: number;
  date: string;
  time_from: string;
  time_to: string;
  note: string | null;
  status: string;
  token: string;
  created_at: Date;
}

function mapRow(row: ReservationRow): Reservation {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    seats: row.seats,
    date: row.date,
    timeFrom: row.time_from,
    timeTo: row.time_to,
    note: row.note ?? undefined,
    status: row.status as Reservation['status'],
    token: row.token,
    createdAt: row.created_at.toISOString(),
  };
}

const ACTIVE_CONDITION = `(status = 'confirmed' OR (status = 'pending' AND created_at > NOW() - INTERVAL '${PENDING_TIMEOUT}'))`;

export async function createReservation(reservation: Reservation): Promise<void> {
  await query(
    `INSERT INTO reservations (id, name, email, seats, date, time_from, time_to, note, status, token, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [reservation.id, reservation.name, reservation.email, reservation.seats, reservation.date,
     reservation.timeFrom, reservation.timeTo, reservation.note ?? null, reservation.status,
     reservation.token, reservation.createdAt]
  );
}

export async function findByToken(token: string): Promise<Reservation | null> {
  const row = await queryOne<ReservationRow>(
    'SELECT * FROM reservations WHERE token = $1', [token]
  );
  return row ? mapRow(row) : null;
}

export async function findById(id: string): Promise<Reservation | null> {
  const row = await queryOne<ReservationRow>(
    'SELECT * FROM reservations WHERE id = $1', [id]
  );
  return row ? mapRow(row) : null;
}

export async function updateStatus(id: string, status: Reservation['status']): Promise<void> {
  await query('UPDATE reservations SET status = $1 WHERE id = $2', [status, id]);
}

export async function getReservationsByDate(date: string): Promise<Reservation[]> {
  const rows = await query<ReservationRow>(
    `SELECT * FROM reservations WHERE date = $1 AND ${ACTIVE_CONDITION} ORDER BY time_from`,
    [date]
  );
  return rows.map(mapRow);
}

export async function getReservedSeats(date: string, timeFrom: string, timeTo: string): Promise<number> {
  const rows = await query<{ total: string }>(
    `SELECT COALESCE(SUM(seats), 0) as total FROM reservations
     WHERE date = $1 AND time_from < $3 AND time_to > $2 AND ${ACTIVE_CONDITION}`,
    [date, timeFrom, timeTo]
  );
  return parseInt(rows[0]?.total ?? '0', 10);
}

export function getTotalSeats(): number {
  return parseInt(process.env.TOTAL_SEATS || '40', 10);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/lib/reservations.ts
git commit -m "feat: rewrite reservations lib for PostgreSQL"
```

---

## Task 6: Update All Reservation API Routes

**Files:**
- Modify: `src/app/api/reservations/route.ts`
- Modify: `src/app/api/reservations/availability/route.ts`
- Modify: `src/app/api/reservations/confirm/route.ts`
- Modify: `src/app/api/reservations/cancel/route.ts`
- Modify: `src/app/api/reservations/list/route.ts`
- Modify: `src/app/api/reservations/admin-cancel/route.ts`

- [ ] **Step 1: Rewrite reservations/route.ts (POST — create)**

Replace entire file with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createReservation, getReservedSeats, getTotalSeats } from '@/app/lib/reservations';
import { sendConfirmationRequest } from '@/app/lib/email';
import type { Reservation } from '@/app/types';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, seats, date, timeFrom, timeTo, note } = body;

  if (!name || !email || !seats || !date || !timeFrom || !timeTo) {
    return NextResponse.json({ error: 'Vyplňte všechna povinná pole.' }, { status: 400 });
  }

  if (seats < 1) {
    return NextResponse.json({ error: 'Počet míst musí být alespoň 1.' }, { status: 400 });
  }

  if (timeFrom >= timeTo) {
    return NextResponse.json({ error: 'Čas „od" musí být před časem „do".' }, { status: 400 });
  }

  const reserved = await getReservedSeats(date, timeFrom, timeTo);
  const totalSeats = getTotalSeats();

  if (reserved + seats > totalSeats) {
    return NextResponse.json(
      { error: `Nedostatek volných míst. Dostupných: ${totalSeats - reserved}.` },
      { status: 409 }
    );
  }

  const reservation: Reservation = {
    id: nanoid(),
    name,
    email,
    seats,
    date,
    timeFrom,
    timeTo,
    note: note || undefined,
    status: 'pending',
    token: nanoid(32),
    createdAt: new Date().toISOString(),
  };

  await createReservation(reservation);

  try {
    await sendConfirmationRequest(reservation);
  } catch {
    // Email failed but reservation is saved
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Rewrite reservations/availability/route.ts**

Replace entire file with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getReservationsByDate, getTotalSeats } from '@/app/lib/reservations';

const HOURS = Array.from({ length: 14 }, (_, i) => {
  const h = i + 8;
  return `${h.toString().padStart(2, '0')}:00`;
}); // 08:00 – 21:00

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date');
  if (!date) {
    return NextResponse.json({ error: 'Parametr date je povinný.' }, { status: 400 });
  }

  const reservations = await getReservationsByDate(date);
  const totalSeats = getTotalSeats();

  const hours = HOURS.map((hour) => {
    const nextHour = `${(parseInt(hour) + 1).toString().padStart(2, '0')}:00`;
    const reserved = reservations
      .filter((r) => r.timeFrom < nextHour && r.timeTo > hour)
      .reduce((sum, r) => sum + r.seats, 0);
    return { hour, reserved };
  });

  return NextResponse.json({ date, totalSeats, hours });
}
```

- [ ] **Step 3: Rewrite reservations/confirm/route.ts**

Replace entire file with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { findByToken, updateStatus } from '@/app/lib/reservations';
import { sendConfirmedEmail } from '@/app/lib/email';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(`${BASE_URL}/rezervace?error=invalid`);
  }

  const reservation = await findByToken(token);

  if (!reservation) {
    return NextResponse.redirect(`${BASE_URL}/rezervace?error=not_found`);
  }

  if (reservation.status === 'cancelled') {
    return NextResponse.redirect(`${BASE_URL}/rezervace?error=cancelled`);
  }

  if (reservation.status === 'confirmed') {
    return NextResponse.redirect(`${BASE_URL}/rezervace?confirmed=1`);
  }

  await updateStatus(reservation.id, 'confirmed');

  try {
    await sendConfirmedEmail(reservation);
  } catch {
    // Email failed but reservation is confirmed
  }

  return NextResponse.redirect(`${BASE_URL}/rezervace?confirmed=1`);
}
```

- [ ] **Step 4: Rewrite reservations/cancel/route.ts**

Replace entire file with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { findByToken, updateStatus } from '@/app/lib/reservations';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(`${BASE_URL}/rezervace?error=invalid`);
  }

  const reservation = await findByToken(token);

  if (!reservation) {
    return NextResponse.redirect(`${BASE_URL}/rezervace?error=not_found`);
  }

  await updateStatus(reservation.id, 'cancelled');

  return NextResponse.redirect(`${BASE_URL}/rezervace?cancelled=1`);
}
```

- [ ] **Step 5: Rewrite reservations/list/route.ts**

Replace entire file with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/app/lib/auth';
import { getReservationsByDate } from '@/app/lib/reservations';

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const date = req.nextUrl.searchParams.get('date');
  if (!date) {
    return NextResponse.json({ error: 'Parametr date je povinný.' }, { status: 400 });
  }

  const reservations = await getReservationsByDate(date);

  return NextResponse.json({ reservations });
}
```

- [ ] **Step 6: Rewrite reservations/admin-cancel/route.ts**

Replace entire file with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/app/lib/auth';
import { findById, updateStatus } from '@/app/lib/reservations';

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'ID je povinné.' }, { status: 400 });
  }

  const reservation = await findById(id);
  if (!reservation) {
    return NextResponse.json({ error: 'Rezervace nenalezena.' }, { status: 404 });
  }

  await updateStatus(id, 'cancelled');

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Commit**

```bash
git add src/app/api/reservations/
git commit -m "feat: migrate all reservation routes to PostgreSQL"
```

---

## Task 7: Rewrite Orders Lib and Routes

**Files:**
- Modify: `src/app/lib/orders.ts` (full rewrite)
- Modify: `src/app/api/orders/route.ts`
- Modify: `src/app/api/orders/list/route.ts`

- [ ] **Step 1: Rewrite orders.ts**

Replace entire file with:

```ts
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
    [order.id, order.name, order.phone, order.address, order.village,
     order.note ?? null, order.day, order.date, JSON.stringify(order.items), order.createdAt]
  );
}

export async function getOrdersByDate(date: string): Promise<Order[]> {
  const rows = await query<OrderRow>(
    'SELECT * FROM orders WHERE date = $1 ORDER BY created_at',
    [date]
  );
  return rows.map(mapRow);
}
```

- [ ] **Step 2: Rewrite orders/route.ts**

Replace entire file with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { randomUUID } from 'crypto';
import { createOrder } from '@/app/lib/orders';
import { query } from '@/app/lib/db';
import type { OrderItem, Order } from '@/app/types';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

async function loadVillages(): Promise<string[]> {
  const rows = await query<{ name: string }>('SELECT name FROM delivery_villages ORDER BY name');
  return rows.map((r) => r.name);
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

  await createOrder(order);

  const totalPrice = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

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
```

- [ ] **Step 3: Rewrite orders/list/route.ts**

Replace entire file with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/app/lib/auth';
import { getOrdersByDate } from '@/app/lib/orders';

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const date = req.nextUrl.searchParams.get('date');
  if (!date) {
    return NextResponse.json({ error: 'Parametr date je povinný.' }, { status: 400 });
  }

  const orders = await getOrdersByDate(date);

  return NextResponse.json({ orders });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/lib/orders.ts src/app/api/orders/
git commit -m "feat: migrate orders to PostgreSQL"
```

---

## Task 8: Migrate Opening Hours API to PostgreSQL

**Files:**
- Modify: `src/app/api/opening-hours/route.ts`

- [ ] **Step 1: Rewrite opening-hours/route.ts**

Replace entire file with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/app/lib/auth';
import { query, queryOne } from '@/app/lib/db';

export async function GET() {
  const row = await queryOne<{ text: string }>('SELECT text FROM opening_hours WHERE id = 1');
  return NextResponse.json({ text: row?.text ?? '' });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { text } = await req.json();

  await query(
    'INSERT INTO opening_hours (id, text) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET text = $1',
    [text]
  );

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/opening-hours/route.ts
git commit -m "feat: migrate opening hours to PostgreSQL"
```

---

## Task 9: Migrate Delivery Villages API to PostgreSQL

**Files:**
- Modify: `src/app/api/delivery-villages/route.ts`

- [ ] **Step 1: Rewrite delivery-villages/route.ts**

Replace entire file with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/app/lib/auth';
import { query } from '@/app/lib/db';

export async function GET() {
  const rows = await query<{ name: string }>('SELECT name FROM delivery_villages ORDER BY name');
  return NextResponse.json({ villages: rows.map((r) => r.name) });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { villages } = await req.json();
  const list = (villages as string)
    .split('\n')
    .map((v: string) => v.trim())
    .filter((v: string) => v.length > 0);

  await query('DELETE FROM delivery_villages');
  for (const name of list) {
    await query('INSERT INTO delivery_villages (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/delivery-villages/route.ts
git commit -m "feat: migrate delivery villages to PostgreSQL"
```

---

## Task 10: Migrate Menu API to PostgreSQL

**Files:**
- Modify: `src/app/api/menu/route.ts`

- [ ] **Step 1: Rewrite menu/route.ts**

Replace entire file with:

```ts
import { NextResponse } from 'next/server';
import { queryOne } from '@/app/lib/db';

export async function GET() {
  const row = await queryOne<{ data: unknown }>('SELECT data FROM weekly_menu WHERE id = 1');
  return NextResponse.json(row?.data ?? { days: [] });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/menu/route.ts
git commit -m "feat: migrate menu API to PostgreSQL"
```

---

## Task 11: Migrate Upload API to Local Filesystem + DB

**Files:**
- Modify: `src/app/api/upload/route.ts`

- [ ] **Step 1: Rewrite upload/route.ts**

Replace entire file with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { isAuthenticated } from '@/app/lib/auth';
import { saveFile, getPublicUrl } from '@/app/lib/storage';
import { query } from '@/app/lib/db';
import type { WeeklyMenu } from '@/app/types';

function createAltText(fullText: string): string {
  if (fullText.length <= 150) return fullText;
  const truncated = fullText.slice(0, 150);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
}

function menuToText(menu: WeeklyMenu): string {
  return menu.days
    .map((day) => {
      const meals = day.meals.map((m) => `${m.name} ${m.price} Kč`).join(', ');
      return `${day.day} ${day.date}: ${meals}`;
    })
    .join('. ');
}

async function extractMenu(imageBuffer: Buffer): Promise<WeeklyMenu | null> {
  try {
    const client = new Anthropic();
    const base64 = imageBuffer.toString('base64');

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/webp', data: base64 },
            },
            {
              type: 'text',
              text: `Analyzuj tento obrázek týdenní nabídky jídel. Vrať POUZE validní JSON v tomto formátu, nic dalšího:
{"days":[{"day":"Pondělí","date":"YYYY-MM-DD","meals":[{"name":"Název jídla","price":145}]}]}
Pokud datum není na obrázku, odhadni ho podle aktuálního týdne. Cenu uveď jako číslo bez Kč.`,
            },
          ],
        },
      ],
    });

    for (const block of response.content) {
      if (block.type === 'text') {
        const text = block.text.trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as WeeklyMenu;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const type = formData.get('type') as string;

  if (!file || !type) {
    return NextResponse.json({ message: 'File or type not provided' }, { status: 400 });
  }

  const filename = `${type}.webp`;
  const imageBuffer = Buffer.from(await file.arrayBuffer());

  await saveFile('menu', filename, imageBuffer);

  const url = getPublicUrl('menu', filename);
  let menuSaved = false;

  if (type === 'weekly') {
    const menu = await extractMenu(imageBuffer);
    if (menu) {
      // Save structured menu to DB
      await query(
        'INSERT INTO weekly_menu (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = $1',
        [JSON.stringify(menu)]
      );
      menuSaved = true;

      // Save OCR data to DB
      const fullText = menuToText(menu);
      const altText = createAltText(fullText);
      await query(
        `INSERT INTO menu_images (type, full_text, alt_text) VALUES ($1, $2, $3)
         ON CONFLICT (type) DO UPDATE SET full_text = $2, alt_text = $3`,
        [type, fullText, altText]
      );
    }
  }

  return NextResponse.json({ url, menuSaved });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/upload/route.ts
git commit -m "feat: migrate upload API to local filesystem + PostgreSQL"
```

---

## Task 12: Migrate Delete API to Local Filesystem + DB

**Files:**
- Modify: `src/app/api/delete/route.ts`

- [ ] **Step 1: Rewrite delete/route.ts**

Replace entire file with:

```ts
import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/app/lib/auth';
import { deleteFile } from '@/app/lib/storage';
import { query } from '@/app/lib/db';

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { type } = await req.json();

  if (!type) {
    return NextResponse.json({ message: 'No type provided' }, { status: 400 });
  }

  await deleteFile('menu', `${type}.webp`);

  // Clean up OCR data from DB
  await query('DELETE FROM menu_images WHERE type = $1', [type]);

  // If weekly, also clear the menu data
  if (type === 'weekly') {
    await query(
      "INSERT INTO weekly_menu (id, data) VALUES (1, '{\"days\":[]}'::jsonb) ON CONFLICT (id) DO UPDATE SET data = '{\"days\":[]}'::jsonb"
    );
  }

  return NextResponse.json({ message: 'Deleted successfully' });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/delete/route.ts
git commit -m "feat: migrate delete API to local filesystem + PostgreSQL"
```

---

## Task 13: Migrate Gallery API to Local Filesystem + PostgreSQL

**Files:**
- Modify: `src/app/api/gallery/route.ts`

- [ ] **Step 1: Rewrite gallery/route.ts**

Replace entire file with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { isAuthenticated } from '@/app/lib/auth';
import { saveFile, deleteFile, getPublicUrl } from '@/app/lib/storage';
import { query } from '@/app/lib/db';
import type { GalleryItem } from '@/app/types';

interface GalleryRow {
  id: string;
  type: string;
  filename: string;
  created_at: Date;
}

function mapRow(row: GalleryRow): GalleryItem {
  return {
    id: row.id,
    type: row.type as GalleryItem['type'],
    url: getPublicUrl('gallery', row.filename),
    createdAt: row.created_at.toISOString(),
  };
}

export async function GET() {
  const rows = await query<GalleryRow>('SELECT * FROM gallery ORDER BY created_at DESC');
  return NextResponse.json({ items: rows.map(mapRow) });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File;
  if (!file) {
    return NextResponse.json({ error: 'Soubor nebyl poskytnut.' }, { status: 400 });
  }

  const isVideo = file.type.startsWith('video/');
  const ext = isVideo ? 'mp4' : 'webp';
  const id = nanoid();
  const filename = `gallery-${id}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await saveFile('gallery', filename, buffer);

  const rows = await query<GalleryRow>(
    `INSERT INTO gallery (id, type, filename) VALUES ($1, $2, $3) RETURNING *`,
    [id, isVideo ? 'video' : 'image', filename]
  );

  return NextResponse.json({ ok: true, item: mapRow(rows[0]) });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'ID je povinné.' }, { status: 400 });
  }

  const rows = await query<GalleryRow>('SELECT * FROM gallery WHERE id = $1', [id]);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Položka nenalezena.' }, { status: 404 });
  }

  await deleteFile('gallery', rows[0].filename);
  await query('DELETE FROM gallery WHERE id = $1', [id]);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/gallery/route.ts
git commit -m "feat: migrate gallery API to local filesystem + PostgreSQL"
```

---

## Task 14: Update Homepage (page.tsx) to Use DB + Local Filesystem

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Rewrite page.tsx**

Replace entire file with:

```tsx
import Footer from '@/app/components/Footer';
import Navigation from '@/app/components/Navigation';
import MenuImages from '@/app/components/MenuImages';
import Gallery from '@/app/components/Gallery';
import { IMAGE_TYPES, type ImageOcrData } from '@/app/types';
import { queryOne } from '@/app/lib/db';
import { fileExists, getPublicUrl } from '@/app/lib/storage';

export const revalidate = 60;

async function fetchOpeningHours(): Promise<string | undefined> {
  const row = await queryOne<{ text: string }>('SELECT text FROM opening_hours WHERE id = 1');
  return row?.text || undefined;
}

async function fetchOcrData(type: string): Promise<ImageOcrData | undefined> {
  const row = await queryOne<{ full_text: string; alt_text: string }>(
    'SELECT full_text, alt_text FROM menu_images WHERE type = $1',
    [type]
  );
  return row ? { fullText: row.full_text, altText: row.alt_text } : undefined;
}

export default async function HomePage() {
  const openingHours = await fetchOpeningHours();

  const ts = Date.now();
  const resolved = await Promise.all(
    IMAGE_TYPES.map(async (type) => {
      const [imageUrl, ocrData] = await Promise.all([
        (async () => {
          if (await fileExists('menu', `${type}.webp`))
            return `${getPublicUrl('menu', `${type}.webp`)}?${ts}`;
          if (await fileExists('menu', `${type}.jpg`))
            return `${getPublicUrl('menu', `${type}.jpg`)}?${ts}`;
          return null;
        })(),
        fetchOcrData(type),
      ]);
      return [type, imageUrl, ocrData] as const;
    })
  );

  const availableImages: Record<string, string> = {};
  const ocrDataMap: Record<string, ImageOcrData> = {};
  const availability: Record<string, boolean> = {};

  for (const [type, url, ocrData] of resolved) {
    availability[type] = url !== null;
    if (url) availableImages[type] = url;
    if (ocrData) ocrDataMap[type] = ocrData;
  }

  const visibleSections = {
    action: !!availability.action,
    weekly: !!availability.weekly,
    permanent: !!availability.permanent1,
  };

  return (
    <div>
      <Navigation visibleImages={visibleSections} />
      <main className="pt-12 bg-black">
        <MenuImages
          availableImages={availableImages}
          visibleSections={visibleSections}
          ocrData={ocrDataMap}
        />
        <Gallery />
        <Footer openingHours={openingHours} />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: migrate homepage to use DB + local filesystem"
```

---

## Task 15: Update Admin Page URL References

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Replace BLOB_BASE_URL with UPLOADS_URL**

Find line 11:
```ts
const BLOB_BASE_URL = process.env.NEXT_PUBLIC_BLOB_BASE_URL;
```

Replace with:
```ts
const UPLOADS_URL = process.env.NEXT_PUBLIC_UPLOADS_URL;
```

- [ ] **Step 2: Update image URL construction**

Find (around line 118):
```ts
const webpUrl = `${BLOB_BASE_URL}/${type}.webp`;
```
Replace with:
```ts
const webpUrl = `${UPLOADS_URL}/menu/${type}.webp`;
```

Find (around line 120):
```ts
const jpgUrl = `${BLOB_BASE_URL}/${type}.jpg`;
```
Replace with:
```ts
const jpgUrl = `${UPLOADS_URL}/menu/${type}.jpg`;
```

- [ ] **Step 3: Update delete request body**

The delete API now expects `{ type }` instead of `{ url, type }`. Find the delete fetch call and update the body to send only `{ type }`.

Search for `fetch('/api/delete'` and ensure the body is:
```ts
body: JSON.stringify({ type }),
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: update admin page to use UPLOADS_URL"
```

---

## Task 16: Verify Build

- [ ] **Step 1: Add local .env for development**

Create/update `.env.local` with:

```
DATABASE_URL=postgresql://hospodaracice:password@localhost:5432/hospodaracice
UPLOADS_DIR=./uploads
NEXT_PUBLIC_UPLOADS_URL=/uploads
NEXT_PUBLIC_BASE_URL=http://localhost:3008
ADMIN_SECRET=test
TOTAL_SEATS=40
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: No errors (all `@vercel/blob` imports should be gone).

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: Build succeeds. The `.next/standalone/` directory is created.

- [ ] **Step 4: Fix any build/lint errors**

If there are errors, fix them. Common issues:
- Leftover `@vercel/blob` imports
- Type mismatches from the row mapping
- Missing imports

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build errors from migration"
```

---

## Task 17: Create Data Migration Script

**Files:**
- Create: `scripts/migrate-data.ts`

- [ ] **Step 1: Create the migration script**

This script downloads data from Vercel Blob and imports it into PostgreSQL + local filesystem.

```ts
// scripts/migrate-data.ts
import { Pool } from 'pg';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

const BLOB_BASE = process.env.VERCEL_BLOB_BASE_URL;
const UPLOADS_DIR = process.env.UPLOADS_DIR || '/opt/hospodaracice/uploads';
const DATABASE_URL = process.env.DATABASE_URL;

if (!BLOB_BASE || !DATABASE_URL) {
  console.error('Set VERCEL_BLOB_BASE_URL and DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function fetchJson(filename: string): Promise<unknown | null> {
  try {
    const res = await fetch(`${BLOB_BASE}/${filename}`);
    if (res.ok) return await res.json();
  } catch { /* ignore */ }
  return null;
}

async function downloadFile(filename: string, destDir: string): Promise<boolean> {
  try {
    const res = await fetch(`${BLOB_BASE}/${filename}`);
    if (!res.ok) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    mkdirSync(destDir, { recursive: true });
    writeFileSync(path.join(destDir, filename), buffer);
    console.log(`Downloaded: ${filename}`);
    return true;
  } catch {
    return false;
  }
}

async function migrate() {
  console.log('=== Migrating data from Vercel Blob ===');

  // 1. Opening hours
  const oh = await fetchJson('opening-hours.json') as { text?: string } | null;
  if (oh?.text) {
    await pool.query(
      'INSERT INTO opening_hours (id, text) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET text = $1',
      [oh.text]
    );
    console.log('Migrated: opening hours');
  }

  // 2. Delivery villages
  const dv = await fetchJson('delivery-villages.json') as { villages?: string[] } | null;
  if (dv?.villages) {
    for (const name of dv.villages) {
      await pool.query('INSERT INTO delivery_villages (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
    }
    console.log(`Migrated: ${dv.villages.length} delivery villages`);
  }

  // 3. Weekly menu
  const menu = await fetchJson('weekly-menu.json');
  if (menu) {
    await pool.query(
      'INSERT INTO weekly_menu (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = $1',
      [JSON.stringify(menu)]
    );
    console.log('Migrated: weekly menu');
  }

  // 4. OCR data for menu images
  const imageTypes = ['action', 'weekly', 'permanent1', 'permanent2', 'permanent3', 'permanent4'];
  for (const type of imageTypes) {
    const ocr = await fetchJson(`${type}.json`) as { fullText?: string; altText?: string } | null;
    if (ocr?.fullText) {
      await pool.query(
        `INSERT INTO menu_images (type, full_text, alt_text) VALUES ($1, $2, $3)
         ON CONFLICT (type) DO UPDATE SET full_text = $2, alt_text = $3`,
        [type, ocr.fullText, ocr.altText || '']
      );
      console.log(`Migrated: OCR data for ${type}`);
    }
  }

  // 5. Reservations
  const reservations = await fetchJson('reservations.json') as Array<{
    id: string; name: string; email: string; seats: number;
    date: string; timeFrom: string; timeTo: string; note?: string;
    status: string; token: string; createdAt: string;
  }> | null;
  if (reservations) {
    for (const r of reservations) {
      await pool.query(
        `INSERT INTO reservations (id, name, email, seats, date, time_from, time_to, note, status, token, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
        [r.id, r.name, r.email, r.seats, r.date, r.timeFrom, r.timeTo, r.note || null, r.status, r.token, r.createdAt]
      );
    }
    console.log(`Migrated: ${reservations.length} reservations`);
  }

  // 6. Orders
  const orders = await fetchJson('orders.json') as Array<{
    id: string; name: string; phone: string; address: string; village: string;
    note?: string; day: string; date: string; items: unknown; createdAt: string;
  }> | null;
  if (orders) {
    for (const o of orders) {
      await pool.query(
        `INSERT INTO orders (id, name, phone, address, village, note, day, date, items, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
        [o.id, o.name, o.phone, o.address, o.village, o.note || null, o.day, o.date, JSON.stringify(o.items), o.createdAt]
      );
    }
    console.log(`Migrated: ${orders.length} orders`);
  }

  // 7. Gallery
  const gallery = await fetchJson('gallery.json') as Array<{
    id: string; type: string; url: string; createdAt: string;
  }> | null;
  if (gallery) {
    const galleryDir = path.join(UPLOADS_DIR, 'gallery');
    mkdirSync(galleryDir, { recursive: true });
    for (const item of gallery) {
      const filename = item.url.split('/').pop()!;
      // Download file
      try {
        const res = await fetch(item.url);
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          writeFileSync(path.join(galleryDir, filename), buffer);
        }
      } catch { /* skip */ }
      await pool.query(
        `INSERT INTO gallery (id, type, filename, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
        [item.id, item.type, filename, item.createdAt]
      );
    }
    console.log(`Migrated: ${gallery.length} gallery items`);
  }

  // 8. Menu images (files)
  const menuDir = path.join(UPLOADS_DIR, 'menu');
  mkdirSync(menuDir, { recursive: true });
  for (const type of imageTypes) {
    await downloadFile(`${type}.webp`, menuDir);
    await downloadFile(`${type}.jpg`, menuDir);
  }

  await pool.end();
  console.log('=== Migration complete ===');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Add script command to package.json**

Add to `scripts`:

```json
"migrate:data": "npx tsx scripts/migrate-data.ts"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-data.ts package.json
git commit -m "feat: add Vercel Blob to VPS data migration script"
```

---

## Task 18: Create Deploy Script

**Files:**
- Create: `scripts/deploy.sh`

- [ ] **Step 1: Create deploy script**

```bash
#!/bin/bash
# scripts/deploy.sh — Deploy hospodaracice.cz to VPS
set -e

APP_DIR="/opt/hospodaracice/app"

echo "=== Deploying hospodaracice.cz ==="

cd "$APP_DIR"

echo "Pulling latest code..."
git pull

echo "Installing dependencies..."
npm ci

echo "Running database migrations..."
npm run db:migrate

echo "Building application..."
npm run build

# Copy static files to standalone
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

echo "Restarting application..."
pm2 restart hospodaracice 2>/dev/null || pm2 start .next/standalone/server.js \
  --name hospodaracice \
  -- -p 3002

echo "=== Deploy complete ==="
```

- [ ] **Step 2: Make executable**

```bash
chmod +x scripts/deploy.sh
```

- [ ] **Step 3: Commit**

```bash
git add scripts/deploy.sh
git commit -m "feat: add VPS deploy script"
```

---

## Task 19: VPS Server Setup

This task is executed on the VPS via SSH.

- [ ] **Step 1: Create PostgreSQL database and user**

```bash
ssh root@204.168.176.128 "sudo -u postgres psql -c \"CREATE USER hospodaracice WITH PASSWORD 'GENERATE_STRONG_PASSWORD';\" && sudo -u postgres psql -c \"CREATE DATABASE hospodaracice OWNER hospodaracice;\""
```

Replace `GENERATE_STRONG_PASSWORD` with a real password.

- [ ] **Step 2: Create directory structure**

```bash
ssh root@204.168.176.128 "mkdir -p /opt/hospodaracice/{app,uploads/{menu,gallery}}"
```

- [ ] **Step 3: Clone the repo**

```bash
ssh root@204.168.176.128 "git clone https://github.com/claryaldringen/hospodaracice.cz.git /opt/hospodaracice/app"
```

- [ ] **Step 4: Create .env file on VPS**

```bash
ssh root@204.168.176.128 "cat > /opt/hospodaracice/app/.env << 'ENVEOF'
DATABASE_URL=postgresql://hospodaracice:GENERATE_STRONG_PASSWORD@localhost:5432/hospodaracice
UPLOADS_DIR=/opt/hospodaracice/uploads
NEXT_PUBLIC_UPLOADS_URL=https://hospodaracice.cz/uploads
NEXT_PUBLIC_BASE_URL=https://hospodaracice.cz
ADMIN_SECRET=EXISTING_ADMIN_SECRET
RESEND_API_KEY=EXISTING_RESEND_KEY
ANTHROPIC_API_KEY=EXISTING_ANTHROPIC_KEY
ORDER_EMAIL=EXISTING_ORDER_EMAIL
TOTAL_SEATS=40
ENVEOF"
```

Fill in actual values from the existing Vercel environment.

- [ ] **Step 5: Run database migration**

```bash
ssh root@204.168.176.128 "cd /opt/hospodaracice/app && npm ci && npm run db:migrate"
```

- [ ] **Step 6: Run data migration from Vercel Blob**

```bash
ssh root@204.168.176.128 "cd /opt/hospodaracice/app && VERCEL_BLOB_BASE_URL=https://gvqm7qg0dumnn0iw.public.blob.vercel-storage.com npm run migrate:data"
```

- [ ] **Step 7: Build and start with PM2**

```bash
ssh root@204.168.176.128 "cd /opt/hospodaracice/app && npm run build && cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public && pm2 start .next/standalone/server.js --name hospodaracice -- -p 3002 && pm2 save"
```

- [ ] **Step 8: Update Caddy config**

```bash
ssh root@204.168.176.128 "cat >> /etc/caddy/Caddyfile << 'CADDYEOF'

hospodaracice.cz {
    handle /uploads/* {
        root * /opt/hospodaracice
        file_server {
            precompressed gzip
        }
        header Cache-Control \"public, max-age=31536000, immutable\"
    }

    handle {
        reverse_proxy localhost:3002
    }
}

hospodanapalouku.cz, racickahospoda.cz, restauracenapalouku.cz {
    redir https://hospodaracice.cz{uri} permanent
}

www.hospodaracice.cz, www.hospodanapalouku.cz, www.racickahospoda.cz, www.restauracenapalouku.cz {
    redir https://hospodaracice.cz{uri} permanent
}
CADDYEOF"
```

- [ ] **Step 9: Reload Caddy**

```bash
ssh root@204.168.176.128 "caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy"
```

---

## Task 20: DNS Configuration at Subreg

- [ ] **Step 1: Set DNS records**

Log in to Subreg and set the following A records for all 4 domains:

| Doména | Typ | Název | Hodnota |
|---|---|---|---|
| hospodaracice.cz | A | @ | 204.168.176.128 |
| hospodaracice.cz | A | www | 204.168.176.128 |
| hospodanapalouku.cz | A | @ | 204.168.176.128 |
| hospodanapalouku.cz | A | www | 204.168.176.128 |
| racickahospoda.cz | A | @ | 204.168.176.128 |
| racickahospoda.cz | A | www | 204.168.176.128 |
| restauracenapalouku.cz | A | @ | 204.168.176.128 |
| restauracenapalouku.cz | A | www | 204.168.176.128 |

Remove any existing CNAME or A records pointing to Vercel.

- [ ] **Step 2: Wait for DNS propagation**

```bash
dig hospodaracice.cz +short
```

Expected: `204.168.176.128`

- [ ] **Step 3: Verify HTTPS**

After DNS propagates, Caddy will automatically obtain Let's Encrypt certificates. Verify:

```bash
curl -I https://hospodaracice.cz
```

Expected: HTTP 200 with valid TLS.

- [ ] **Step 4: Verify 301 redirects**

```bash
curl -I https://hospodanapalouku.cz
curl -I https://racickahospoda.cz
curl -I https://restauracenapalouku.cz
curl -I https://www.hospodaracice.cz
```

Expected: All return `301 Moved Permanently` → `https://hospodaracice.cz`

- [ ] **Step 5: Smoke test the application**

Open `https://hospodaracice.cz` in a browser and verify:
- Homepage loads with menu images
- Gallery displays
- Opening hours show in footer
- Admin login works (`/admin`)
- Reservation form works (`/rezervace`)
- Order form works (`/objednavka`)
