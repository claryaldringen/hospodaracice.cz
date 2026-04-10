# Admin Orders Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an orders overview section to the admin panel with day picker and two views (summary table + per-village table).

**Architecture:** Persist orders to `orders.json` in Vercel Blob (same pattern as reservations). Add admin list endpoint. Extend admin page with a new section containing date picker and tab-switchable views.

**Tech Stack:** Next.js App Router, Vercel Blob, React (client component), TypeScript

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/app/types.ts` | Modify | Add `Order` interface |
| `src/app/lib/orders.ts` | Create | Read/write `orders.json` from Blob |
| `src/app/api/orders/route.ts` | Modify | Also persist order to Blob on POST |
| `src/app/api/orders/list/route.ts` | Create | GET orders by date (admin-only) |
| `src/app/admin/page.tsx` | Modify | Add orders section with two views |

---

### Task 1: Add Order type

**Files:**
- Modify: `src/app/types.ts`

- [ ] **Step 1: Add Order interface to types.ts**

Add after the `OrderItem` interface:

```typescript
export interface Order {
  id: string;
  name: string;
  phone: string;
  address: string;
  village: string;
  note?: string;
  day: string;
  date: string;
  items: OrderItem[];
  createdAt: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/types.ts
git commit -m "feat: add Order interface to types"
```

---

### Task 2: Create orders lib

**Files:**
- Create: `src/app/lib/orders.ts`

- [ ] **Step 1: Create orders.ts with load/save functions**

Follow the same pattern as `src/app/lib/reservations.ts`. Use `orders.json` as the blob filename. Clean up orders older than 30 days on save.

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/lib/orders.ts
git commit -m "feat: add orders lib for Blob persistence"
```

---

### Task 3: Persist orders on submission

**Files:**
- Modify: `src/app/api/orders/route.ts`

- [ ] **Step 1: Import orders lib and crypto**

Add at the top of the file:

```typescript
import { randomUUID } from 'crypto';
import { loadOrders, saveOrders } from '@/app/lib/orders';
import type { Order } from '@/app/types';
```

Remove the existing `import type { OrderItem } from '@/app/types';` since `OrderItem` is used via the `Order` type context (it's still needed for the `items as OrderItem[]` casts — keep it but combine into one import).

- [ ] **Step 2: Save order to Blob after validation, before sending email**

After the village validation block (line ~41) and before `const totalPrice`, add:

```typescript
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
```

Use `order.items` for the rest of the route instead of `items as OrderItem[]` where applicable.

- [ ] **Step 3: Verify the build compiles**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/orders/route.ts
git commit -m "feat: persist orders to Blob on submission"
```

---

### Task 4: Create orders list endpoint

**Files:**
- Create: `src/app/api/orders/list/route.ts`

- [ ] **Step 1: Create the admin list endpoint**

Follow the same pattern as `src/app/api/reservations/list/route.ts`. Filter orders by `date` query parameter. Require authentication.

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/orders/list/route.ts
git commit -m "feat: add admin orders list endpoint"
```

---

### Task 5: Add orders section to admin panel

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Add state and types for orders**

Import `Order` from types. Add these state variables to `AdminPage`:

```typescript
const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
const [orders, setOrders] = useState<Order[]>([]);
const [orderView, setOrderView] = useState<'summary' | 'village'>('summary');
```

Add import of `Order` type to the existing import from `@/app/types`.

- [ ] **Step 2: Add loadOrders callback and effect**

```typescript
const loadOrders = useCallback(async (d: string) => {
  try {
    const res = await fetch(`/api/orders/list?date=${d}`);
    if (res.ok) {
      const data = await res.json();
      setOrders(data.orders || []);
    }
  } catch {
    // ignore
  }
}, []);

useEffect(() => {
  if (isAuthenticated) loadOrders(orderDate);
}, [isAuthenticated, orderDate, loadOrders]);
```

- [ ] **Step 3: Compute aggregated data for both views**

Add computed values (derived from `orders` state):

```typescript
// Summary view: aggregate items across all orders
const orderSummary = orders.reduce<Record<string, { name: string; quantity: number; totalPrice: number }>>(
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
const summaryRows = Object.values(orderSummary);
const summaryTotal = summaryRows.reduce((sum, r) => sum + r.totalPrice, 0);

// Village view: group items by village
const ordersByVillage = orders.reduce<Record<string, { name: string; quantity: number }[]>>(
  (acc, order) => {
    if (!acc[order.village]) acc[order.village] = [];
    for (const item of order.items) {
      const existing = acc[order.village].find((r) => r.name === item.name);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        acc[order.village].push({ name: item.name, quantity: item.quantity });
      }
    }
    return acc;
  },
  {}
);
```

- [ ] **Step 4: Add orders section JSX**

Add after the Reservations section (before the closing `</main>` tag). Use the same card style as reservations: rounded-2xl bg-white shadow.

```tsx
{/* Orders */}
<div className="mt-6 overflow-hidden rounded-2xl bg-white shadow">
  <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
    <h2 className="font-semibold text-gray-900">Objednávky</h2>
    <input
      type="date"
      value={orderDate}
      onChange={(e) => setOrderDate(e.target.value)}
      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
    />
  </div>

  {/* View toggle */}
  <div className="flex border-b border-gray-100">
    <button
      onClick={() => setOrderView('summary')}
      className={`flex-1 px-4 py-2 text-sm font-medium transition ${
        orderView === 'summary'
          ? 'border-b-2 border-blue-600 text-blue-600'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      Souhrn
    </button>
    <button
      onClick={() => setOrderView('village')}
      className={`flex-1 px-4 py-2 text-sm font-medium transition ${
        orderView === 'village'
          ? 'border-b-2 border-blue-600 text-blue-600'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      Podle obcí
    </button>
  </div>

  <div className="px-5 py-4">
    {orders.length === 0 ? (
      <p className="text-sm text-gray-500">Žádné objednávky na tento den.</p>
    ) : orderView === 'summary' ? (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="pb-2 font-medium">Jídlo</th>
            <th className="pb-2 text-center font-medium">Počet</th>
            <th className="pb-2 text-right font-medium">Cena</th>
          </tr>
        </thead>
        <tbody>
          {summaryRows.map((row) => (
            <tr key={row.name} className="border-b border-gray-100">
              <td className="py-2 text-gray-900">{row.name}</td>
              <td className="py-2 text-center text-gray-600">{row.quantity}x</td>
              <td className="py-2 text-right text-gray-600">{row.totalPrice} Kč</td>
            </tr>
          ))}
          <tr className="font-medium">
            <td className="pt-2 text-gray-900" colSpan={2}>Celkem</td>
            <td className="pt-2 text-right text-gray-900">{summaryTotal} Kč</td>
          </tr>
        </tbody>
      </table>
    ) : (
      <div className="space-y-4">
        {Object.entries(ordersByVillage)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([villageName, items]) => (
            <div key={villageName}>
              <h3 className="mb-1 text-sm font-semibold text-gray-900">{villageName}</h3>
              <table className="w-full text-sm">
                <tbody>
                  {items.map((item) => (
                    <tr key={item.name} className="border-b border-gray-100">
                      <td className="py-1.5 text-gray-700">{item.name}</td>
                      <td className="py-1.5 text-right text-gray-600">{item.quantity}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    )}
  </div>
</div>
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: add orders section to admin panel"
```
