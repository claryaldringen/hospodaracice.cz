# Potvrzování objednávek — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Umožnit hospodě potvrdit (a zrušit) příchozí objednávku jídla z admin panelu i z notifikačního e-mailu; potvrzení/zrušení pošle zákazníkovi e-mail.

**Architecture:** Objednávka dostane stav (`new/confirmed/cancelled`), e-mail zákazníka a náhodný `token`. Potvrzení z e-mailu jde přes neautentizovaný `GET /api/orders/confirm?token=` (token = ochrana), admin akce přes autentizovaný `POST /api/orders/admin-status`. E-maily se sjednotí do `src/app/lib/email.ts`. Staví na hotovém vzoru rezervací.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, PostgreSQL (`pg`), Resend.

## Global Constraints

- **Next.js 15 App Router** — `searchParams` v page komponentách je `Promise`, musí se awaitovat.
- **Žádný testovací framework** — ověření každého tasku = `npm run lint` + `npm run build` (+ manuální průchod, kde je uvedeno). Nezavádět nový test framework (mimo rozsah).
- **UI a e-maily v češtině**, plná diakritika.
- **Path alias:** `@/*` → `./src/*`.
- **E-maily:** `from` = `Hospoda Na Palouku <noreply@hospodaracice.cz>`, `replyTo` = `hospoda@obec-racice.cz` (konstanty `FROM`/`REPLY_TO` v `email.ts`). HTML styl konzistentní se stávajícími rezervačními e-maily.
- **Stavy objednávky:** `'new' | 'confirmed' | 'cancelled'`.
- **Funkce e-mailů musí tiše no-opovat**, pokud chybí `RESEND_API_KEY` (a u notifikace i `ORDER_EMAIL`).
- Práce probíhá na větvi `feat/order-confirmation` (už existuje).

## File Structure

- Create: `db/migrations/004_order_confirmation.sql` — přidá sloupce `email`, `status`, `token`.
- Modify: `src/app/types.ts` — `Order` o `email`, `status`, `token`.
- Modify: `src/app/lib/orders.ts` — persistence + nové dotazy.
- Modify: `src/app/lib/email.ts` — 3 nové funkce + helpery.
- Modify: `src/app/api/orders/route.ts` — create path (email povinný, token, status).
- Create: `src/app/api/orders/confirm/route.ts` — potvrzení z e-mailu (token).
- Create: `src/app/api/orders/admin-status/route.ts` — admin confirm/cancel.
- Create: `src/app/objednavka/potvrzeno/page.tsx` — výsledková stránka.
- Modify: `src/app/components/OrderForm.tsx` — povinné pole e-mail.
- Modify: `src/app/admin/page.tsx` — badge stavu + tlačítka + filtr souhrnu.
- Modify: `src/app/ochrana-osobnich-udaju/page.tsx` — e-mail mezi sbírané údaje.

---

### Task 1: Migrace — schéma objednávek

**Files:**
- Create: `db/migrations/004_order_confirmation.sql`

**Interfaces:**
- Produces: tabulka `orders` se sloupci `email TEXT`, `status TEXT NOT NULL DEFAULT 'new'`, `token TEXT` (UNIQUE index).

- [ ] **Step 1: Vytvoř migrační soubor**

Soubor `db/migrations/004_order_confirmation.sql`:

```sql
ALTER TABLE orders ADD COLUMN email TEXT;
ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE orders ADD COLUMN token TEXT;

-- Historické objednávky považuj za již vyřízené, ať se netváří jako nepotvrzené.
UPDATE orders SET status = 'confirmed';

-- Náhodný token pro potvrzovací odkaz; nullable sloupec povolí více NULL u historických řádků.
CREATE UNIQUE INDEX orders_token_key ON orders (token);
```

- [ ] **Step 2: Spusť migraci**

Run: `npm run db:migrate`
Expected: výpis `Applying 004_order_confirmation.sql...` a `Applied 004_order_confirmation.sql`, nakonec `Migrations complete.` (vyžaduje `.env` s `DATABASE_URL`).

- [ ] **Step 3: Ověř schéma**

Run: `psql "$DATABASE_URL" -c "\d orders"` (nebo ekvivalent)
Expected: ve výpisu jsou sloupce `email`, `status` (default `'new'`, not null), `token` a unikátní index `orders_token_key`.

- [ ] **Step 4: Commit**

```bash
git add db/migrations/004_order_confirmation.sql
git commit -m "feat(db): migrace pro stav, e-mail a token objednávky"
```

---

### Task 2: Datový model a perzistence

**Files:**
- Modify: `src/app/types.ts`
- Modify: `src/app/lib/orders.ts`
- Modify: `src/app/api/orders/route.ts`

**Interfaces:**
- Consumes: tabulka `orders` z Tasku 1.
- Produces:
  - `Order` interface s poli `email: string`, `status: 'new' | 'confirmed' | 'cancelled'`, `token: string`.
  - `createOrder(order: Order): Promise<void>` (ukládá nové sloupce).
  - `findOrderById(id: string): Promise<Order | null>`
  - `findOrderByToken(token: string): Promise<Order | null>`
  - `updateOrderStatus(id: string, status: Order['status']): Promise<void>`

- [ ] **Step 1: Rozšiř `Order` v `src/app/types.ts`**

Nahraď celý interface `Order` (řádky 59–70) tímto:

```ts
export interface Order {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  village: string;
  note?: string;
  day: string;
  date: string;
  items: OrderItem[];
  status: 'new' | 'confirmed' | 'cancelled';
  token: string;
  createdAt: string;
}
```

- [ ] **Step 2: Přepiš `src/app/lib/orders.ts`**

Nahraď celý obsah souboru:

```ts
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

export async function updateOrderStatus(id: string, status: Order['status']): Promise<void> {
  await query('UPDATE orders SET status = $1 WHERE id = $2', [status, id]);
}
```

- [ ] **Step 3: Uprav create-path v `src/app/api/orders/route.ts`**

V `POST` rozšiř destrukturování o `email` (řádek 19):

```ts
  const { name, email, phone, address, village, note, day, date, items } = body;
```

Přidej `email` do kontroly povinných polí (řádek 21–23):

```ts
  if (!name || !email || !phone || !address || !village || !day || !date) {
    return NextResponse.json({ error: 'Vyplňte všechna povinná pole.' }, { status: 400 });
  }
```

Doplň do literálu `order` pole `email`, `status` a `token` (objekt na řádcích 34–45):

```ts
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
```

> Poznámka: inline notifikační e-mail (řádky 49–102) v tomto tasku **ponech beze změny** — přesune se v Tasku 3. Build tím zůstane zelený.

- [ ] **Step 4: Lint + build**

Run: `npm run lint`
Expected: `✔ No ESLint warnings or errors`

Run: `npm run build`
Expected: `✓ Compiled successfully` (žádné TypeScript chyby).

- [ ] **Step 5: Commit**

```bash
git add src/app/types.ts src/app/lib/orders.ts src/app/api/orders/route.ts
git commit -m "feat(orders): datový model objednávky se stavem, e-mailem a tokenem"
```

---

### Task 3: E-mailová vrstva

**Files:**
- Modify: `src/app/lib/email.ts`
- Modify: `src/app/api/orders/route.ts`

**Interfaces:**
- Consumes: `Order` (z Tasku 2), `BASE_URL`, `FROM`, `REPLY_TO`, `getResend` (existují v `email.ts`).
- Produces:
  - `sendOrderNotification(order: Order): Promise<void>` — hospodě, s tlačítkem Potvrdit.
  - `sendOrderConfirmedEmail(order: Order): Promise<void>` — zákazníkovi.
  - `sendOrderCancelledEmail(order: Order): Promise<void>` — zákazníkovi.

- [ ] **Step 1: Přidej import `Order` do `src/app/lib/email.ts`**

Nahraď řádek 2:

```ts
import type { Order, Reservation } from '@/app/types';
```

- [ ] **Step 2: Přidej helpery a tři funkce na konec `src/app/lib/email.ts`**

```ts
function orderTotal(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function orderItemsHtml(order: Order): string {
  return order.items
    .map(
      (item) =>
        `<tr>
          <td style="padding: 6px 12px;">${item.name}</td>
          <td style="padding: 6px 12px; text-align: center;">${item.quantity}×</td>
          <td style="padding: 6px 12px; text-align: right;">${item.price * item.quantity} Kč</td>
        </tr>`
    )
    .join('');
}

export async function sendOrderNotification(order: Order) {
  const notifyTo = process.env.ORDER_EMAIL;
  if (!notifyTo || !process.env.RESEND_API_KEY) return;

  const confirmUrl = `${BASE_URL}/api/orders/confirm?token=${order.token}`;

  await getResend().emails.send({
    from: FROM,
    to: notifyTo,
    replyTo: order.email || REPLY_TO,
    subject: `Nová objednávka — ${order.name}, ${order.village}, ${order.day} ${order.date}`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2>Nová objednávka</h2>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr><td style="padding: 6px 12px; font-weight: bold;">Jméno</td><td style="padding: 6px 12px;">${order.name}</td></tr>
          <tr><td style="padding: 6px 12px; font-weight: bold;">E-mail</td><td style="padding: 6px 12px;">${order.email}</td></tr>
          <tr><td style="padding: 6px 12px; font-weight: bold;">Telefon</td><td style="padding: 6px 12px;">${order.phone}</td></tr>
          <tr><td style="padding: 6px 12px; font-weight: bold;">Adresa</td><td style="padding: 6px 12px;">${order.address}, ${order.village}</td></tr>
          <tr><td style="padding: 6px 12px; font-weight: bold;">Den</td><td style="padding: 6px 12px;">${order.day} ${order.date}</td></tr>
          ${order.note ? `<tr><td style="padding: 6px 12px; font-weight: bold;">Poznámka</td><td style="padding: 6px 12px;">${order.note}</td></tr>` : ''}
        </table>
        <h3>Objednávka</h3>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr style="border-bottom: 1px solid #ddd;">
            <th style="padding: 6px 12px; text-align: left;">Jídlo</th>
            <th style="padding: 6px 12px; text-align: center;">Ks</th>
            <th style="padding: 6px 12px; text-align: right;">Cena</th>
          </tr>
          ${orderItemsHtml(order)}
          <tr style="border-top: 2px solid #333;">
            <td style="padding: 6px 12px; font-weight: bold;" colspan="2">Celkem</td>
            <td style="padding: 6px 12px; text-align: right; font-weight: bold;">${orderTotal(order)} Kč</td>
          </tr>
        </table>
        <a href="${confirmUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 8px 0;">Potvrdit objednávku</a>
      </div>
    `,
  });
}

export async function sendOrderConfirmedEmail(order: Order) {
  if (!order.email || !process.env.RESEND_API_KEY) return;

  await getResend().emails.send({
    from: FROM,
    to: order.email,
    replyTo: REPLY_TO,
    subject: 'Objednávka potvrzena — Hospoda Na Palouku',
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2>Objednávka potvrzena</h2>
        <p>Dobrý den, ${order.name},</p>
        <p>vaši objednávku na ${order.day} ${order.date} jsme potvrdili a připravíme ji k doručení:</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr style="border-bottom: 1px solid #ddd;">
            <th style="padding: 6px 12px; text-align: left;">Jídlo</th>
            <th style="padding: 6px 12px; text-align: center;">Ks</th>
            <th style="padding: 6px 12px; text-align: right;">Cena</th>
          </tr>
          ${orderItemsHtml(order)}
          <tr style="border-top: 2px solid #333;">
            <td style="padding: 6px 12px; font-weight: bold;" colspan="2">Celkem</td>
            <td style="padding: 6px 12px; text-align: right; font-weight: bold;">${orderTotal(order)} Kč</td>
          </tr>
        </table>
        <p>Doručíme na adresu: ${order.address}, ${order.village}.</p>
        <p>Děkujeme za objednávku!</p>
      </div>
    `,
  });
}

export async function sendOrderCancelledEmail(order: Order) {
  if (!order.email || !process.env.RESEND_API_KEY) return;

  await getResend().emails.send({
    from: FROM,
    to: order.email,
    replyTo: REPLY_TO,
    subject: 'Objednávka zrušena — Hospoda Na Palouku',
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2>Objednávka zrušena</h2>
        <p>Dobrý den, ${order.name},</p>
        <p>vaši objednávku na ${order.day} ${order.date} jsme bohužel museli zrušit.</p>
        <p>V případě dotazů nás kontaktujte na <a href="mailto:${REPLY_TO}">${REPLY_TO}</a>.</p>
        <p>Omlouváme se za nepříjemnost.</p>
      </div>
    `,
  });
}
```

- [ ] **Step 3: Přepiš `src/app/api/orders/route.ts` na použití `sendOrderNotification`**

Nahraď celý obsah souboru:

```ts
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
```

- [ ] **Step 4: Lint + build**

Run: `npm run lint`
Expected: `✔ No ESLint warnings or errors` (žádný nepoužitý import `Resend`).

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add src/app/lib/email.ts src/app/api/orders/route.ts
git commit -m "feat(email): notifikace s tlačítkem Potvrdit + e-maily o potvrzení a zrušení"
```

---

### Task 4: Pole e-mail v objednávkovém formuláři

**Files:**
- Modify: `src/app/components/OrderForm.tsx`

**Interfaces:**
- Consumes: `POST /api/orders` (vyžaduje `email` — z Tasku 3).

- [ ] **Step 1: Přidej stav `email`**

Za řádek `const [name, setName] = useState('');` (řádek 15) přidej:

```tsx
  const [email, setEmail] = useState('');
```

- [ ] **Step 2: Přidej validaci e-mailu v `handleSubmit`**

Za blok validace telefonu (po řádku 90, tj. po `}` uzavírajícím `if (!isValidPhone(phone))`) přidej:

```tsx
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setResult({ type: 'error', text: 'Zadejte platný e-mail.' });
      return;
    }
```

- [ ] **Step 3: Pošli `email` v POST body**

V `JSON.stringify({ ... })` (řádky 99–107) přidej `email,` hned za `name,`:

```tsx
        body: JSON.stringify({
          name,
          email,
          phone,
          address,
          village,
          note,
          day: selectedDay.day,
          date: selectedDay.date,
          items: orderItems,
        }),
```

- [ ] **Step 4: Vyresetuj `email` po úspěšném odeslání**

V success větvi (po `setName('');`, řádek 114) přidej:

```tsx
        setEmail('');
```

- [ ] **Step 5: Přidej input pole E-mail do formuláře**

Hned za `<input ... placeholder="Jméno" ... />` (uzavírací `/>` na řádku 220) vlož:

```tsx
            <input
              type="email"
              required
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/50 transition focus:border-white/50 focus:outline-none"
            />
```

- [ ] **Step 6: Lint + build**

Run: `npm run lint`
Expected: `✔ No ESLint warnings or errors`

Run: `npm run build`
Expected: `✓ Compiled successfully`

- [ ] **Step 7: Manuální ověření create flow**

Spusť `npm run dev`, otevři homepage, vyber den a jídlo, zkus odeslat bez e-mailu → formulář nepovolí (HTML `required`) / s neplatným e-mailem → hláška „Zadejte platný e-mail.". S platným e-mailem → „Objednávka odeslána!". (Pokud je nakonfigurovaný Resend, dorazí notifikace s tlačítkem Potvrdit.)

- [ ] **Step 8: Commit**

```bash
git add src/app/components/OrderForm.tsx
git commit -m "feat(orders): povinné pole e-mail v objednávkovém formuláři"
```

---

### Task 5: Potvrzení z e-mailu — route + výsledková stránka

**Files:**
- Create: `src/app/api/orders/confirm/route.ts`
- Create: `src/app/objednavka/potvrzeno/page.tsx`

**Interfaces:**
- Consumes: `findOrderByToken`, `updateOrderStatus` (Task 2), `sendOrderConfirmedEmail` (Task 3).
- Produces: `GET /api/orders/confirm?token=` → redirect na `/objednavka/potvrzeno?status=<confirmed|already|cancelled|notfound>`.

- [ ] **Step 1: Vytvoř `src/app/api/orders/confirm/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { findOrderByToken, updateOrderStatus } from '@/app/lib/orders';
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

  await updateOrderStatus(order.id, 'confirmed');

  try {
    await sendOrderConfirmedEmail({ ...order, status: 'confirmed' });
  } catch (err) {
    console.error('sendOrderConfirmedEmail failed:', err);
  }

  return NextResponse.redirect(`${BASE_URL}/objednavka/potvrzeno?status=confirmed`);
}
```

- [ ] **Step 2: Vytvoř `src/app/objednavka/potvrzeno/page.tsx`**

```tsx
import Link from 'next/link';

const MESSAGES: Record<string, { title: string; text: string }> = {
  confirmed: {
    title: 'Objednávka potvrzena',
    text: 'Objednávka byla potvrzena. Zákazníkovi jsme poslali potvrzovací e-mail.',
  },
  already: {
    title: 'Již potvrzeno',
    text: 'Tato objednávka už byla potvrzena dříve.',
  },
  cancelled: {
    title: 'Objednávku nelze potvrdit',
    text: 'Tuto objednávku nelze potvrdit — byla zrušena.',
  },
  notfound: {
    title: 'Objednávka nenalezena',
    text: 'Objednávka nebyla nalezena. Odkaz může být neplatný.',
  },
};

export default async function OrderConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const msg = MESSAGES[status ?? ''] ?? MESSAGES.notfound;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold text-gray-900">{msg.title}</h1>
      <p className="max-w-md text-gray-600">{msg.text}</p>
      <Link
        href="/"
        className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-700"
      >
        Zpět na web
      </Link>
    </main>
  );
}
```

- [ ] **Step 3: Lint + build**

Run: `npm run lint`
Expected: `✔ No ESLint warnings or errors`

Run: `npm run build`
Expected: `✓ Compiled successfully` (mj. nová route `/api/orders/confirm` a stránka `/objednavka/potvrzeno`).

- [ ] **Step 4: Manuální ověření**

V DB vezmi `token` čerstvé objednávky se stavem `new` a otevři `http://localhost:3008/api/orders/confirm?token=<token>` → přesměruje na `/objednavka/potvrzeno?status=confirmed`, stav v DB je `confirmed`. Druhý průchod stejným tokenem → `status=already` (žádný druhý e-mail). Neexistující token → `status=notfound`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/orders/confirm/route.ts src/app/objednavka/potvrzeno/page.tsx
git commit -m "feat(orders): potvrzení objednávky odkazem z e-mailu + výsledková stránka"
```

---

### Task 6: Admin API — změna stavu objednávky

**Files:**
- Create: `src/app/api/orders/admin-status/route.ts`

**Interfaces:**
- Consumes: `isAuthenticated` (`@/app/lib/auth`), `findOrderById`, `updateOrderStatus` (Task 2), `sendOrderConfirmedEmail`, `sendOrderCancelledEmail` (Task 3).
- Produces: `POST /api/orders/admin-status` s body `{ id: string, status: 'confirmed' | 'cancelled' }` → `{ ok: true }`.

- [ ] **Step 1: Vytvoř `src/app/api/orders/admin-status/route.ts`**

```ts
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
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint`
Expected: `✔ No ESLint warnings or errors`

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Manuální ověření (volitelné, vyžaduje admin session)**

Po přihlášení do adminu lze ověřit přes Task 7. Bez session vrací route `401`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/orders/admin-status/route.ts
git commit -m "feat(orders): admin API pro potvrzení/zrušení objednávky"
```

---

### Task 7: Admin UI — stav, tlačítka, filtr souhrnu

**Files:**
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `POST /api/orders/admin-status` (Task 6), `Order.status` (Task 2), existující `showStatus`, `loadOrders`, `orderDate`.

- [ ] **Step 1: Přidej handler `handleOrderStatus`**

Za funkci `handleCancelReservation` (končí na řádku ~339) přidej:

```tsx
  const handleOrderStatus = async (id: string, status: 'confirmed' | 'cancelled') => {
    const res = await fetch('/api/orders/admin-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      showStatus(
        'success',
        status === 'confirmed' ? 'Objednávka potvrzena.' : 'Objednávka zrušena.'
      );
      loadOrders(orderDate);
    } else {
      showStatus('error', 'Chyba při změně stavu objednávky.');
    }
  };
```

- [ ] **Step 2: Vynech zrušené objednávky ze souhrnu**

Na řádku 435 nahraď `const orderSummary = orders.reduce<` tak, aby agregace běžela jen nad nezrušenými:

```tsx
  const orderSummary = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce<Record<string, { name: string; quantity: number; totalPrice: number }>>(
      (acc, order) => {
        for (const item of order.items) {
          const key = item.name;
          if (!acc[key]) {
            acc[key] = { name: item.name, quantity: 0, totalPrice: 0 };
          }
          acc[key].quantity += item.quantity;
          acc[key].totalPrice += item.price * item.quantity;
        }
        return acc;
      },
      {}
    );
```

(Nahrazuje stávající blok řádků 435–447.)

- [ ] **Step 3: Přidej badge stavu a tlačítka do karty objednávky (náhled Podle obcí)**

Nahraď celý blok `{villageOrders.map((order) => ( ... ))}` (v původním souboru řádky 974–1004; čísla se po Step 1–2 posunou — kotvi se podle `key={order.id}`) tímto:

```tsx
                        {villageOrders.map((order) => (
                          <div
                            key={order.id}
                            className={`rounded-lg border p-3 text-sm ${
                              order.status === 'cancelled'
                                ? 'border-gray-200 bg-gray-50 opacity-60'
                                : 'border-gray-200 bg-gray-50'
                            }`}
                          >
                            <div className="mb-1 flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {order.name} — {order.phone}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  order.status === 'confirmed'
                                    ? 'bg-green-200 text-green-800'
                                    : order.status === 'cancelled'
                                      ? 'bg-gray-200 text-gray-600'
                                      : 'bg-yellow-200 text-yellow-800'
                                }`}
                              >
                                {order.status === 'confirmed'
                                  ? 'Potvrzená'
                                  : order.status === 'cancelled'
                                    ? 'Zrušená'
                                    : 'Nová'}
                              </span>
                            </div>
                            <div className="mb-2 text-gray-600">{order.address}</div>
                            <table className="w-full">
                              <tbody>
                                {order.items.map((item, i) => (
                                  <tr key={i} className="border-b border-gray-100 last:border-0">
                                    <td className="py-1 text-gray-700">{item.name}</td>
                                    <td className="py-1 text-center text-gray-600">
                                      {item.quantity}x
                                    </td>
                                    <td className="py-1 text-right text-gray-600">
                                      {item.price * item.quantity} Kč
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {order.note && (
                              <div className="mt-2 text-xs text-gray-500">
                                Poznámka: {order.note}
                              </div>
                            )}
                            {order.status === 'new' && (
                              <div className="mt-3 flex gap-2">
                                <button
                                  onClick={() => handleOrderStatus(order.id, 'confirmed')}
                                  className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 transition hover:bg-green-50"
                                >
                                  Potvrdit
                                </button>
                                <button
                                  onClick={() => handleOrderStatus(order.id, 'cancelled')}
                                  className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                                >
                                  Zrušit
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
```

- [ ] **Step 4: Lint + build**

Run: `npm run lint`
Expected: `✔ No ESLint warnings or errors`

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 5: Manuální ověření**

Přihlas se do `/admin`, přepni Objednávky na den s objednávkou a na náhled **Podle obcí**: u nové objednávky je badge „Nová" + tlačítka Potvrdit/Zrušit. Klik na **Potvrdit** → badge „Potvrzená", tlačítka zmizí, zákazníkovi dorazí potvrzovací e-mail (je-li Resend nakonfigurovaný). Klik na **Zrušit** u jiné objednávky → badge „Zrušená", karta ztlumená, dorazí e-mail o zrušení. Přepni na **Souhrn** → zrušená objednávka se nezapočítává.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat(admin): stav objednávky, tlačítka Potvrdit/Zrušit, souhrn bez zrušených"
```

---

### Task 8: GDPR — doplnění e-mailu mezi sbírané údaje

**Files:**
- Modify: `src/app/ochrana-osobnich-udaju/page.tsx`

- [ ] **Step 1: Doplň e-mail do výčtu údajů u objednávek**

Na řádku 39 nahraď:

```tsx
              <strong>Objednávky:</strong> jméno, telefon, adresa, obec, poznámka
```

za:

```tsx
              <strong>Objednávky:</strong> jméno, telefon, e-mail, adresa, obec, poznámka
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint`
Expected: `✔ No ESLint warnings or errors`

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add src/app/ochrana-osobnich-udaju/page.tsx
git commit -m "docs(gdpr): e-mail mezi sbíranými údaji u objednávek"
```

---

## Závěrečné ověření (po všech taskech)

- [ ] `npm run lint` a `npm run build` projdou bez chyb.
- [ ] End-to-end manuální průchod: nová objednávka s e-mailem → notifikace hospodě s tlačítkem → potvrzení z e-mailu i z adminu → potvrzovací e-mail zákazníkovi → zrušení z adminu → e-mail o zrušení → idempotence (druhý klik nic nepošle) → souhrn ignoruje zrušené.
- [ ] **Před `gh pr create` spustit `/code-review`** na diff větve (`origin/main...HEAD`) a vyřešit nálezy (povinné dle CLAUDE.md).

## Pozn. k nasazení

Na produkci (Hetzner VPS) je nutné po nasazení spustit migraci `004` (`npm run db:migrate`) — viz skill `vps-devops`.
```
