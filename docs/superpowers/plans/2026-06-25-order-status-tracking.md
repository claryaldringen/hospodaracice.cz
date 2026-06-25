# Čas a zdroj změny stavu objednávky + potvrzovací dialogy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zaznamenat čas a zdroj (e-mail/admin) změny stavu objednávky a zobrazit je v adminu; přidat potvrzovací dialog před potvrzením i zrušením.

**Architecture:** Nové sloupce `status_changed_at` + `status_source` v `orders`, atomicky zapisované v `setOrderStatusIfNew` (rozšířené o parametr `source`). Confirm route předává `'email'`, admin-status `'admin'`. Admin doplní `window.confirm()` a v kartě objednávky zobrazí čas + zdroj.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, PostgreSQL (`pg`).

## Global Constraints

- **Next.js 15 App Router**, TypeScript, path alias `@/*` → `./src/*`.
- **Žádný testovací framework** — ověření = `npm run lint` (bez chyb; pre-existující `<img>` varování v `admin/page.tsx` a `Gallery.tsx` jsou OK) + `npm run build` (compiled successfully) + manuál. Nezavádět test framework.
- **Stavy:** `status` = `'new' | 'confirmed' | 'cancelled'`. **Zdroj:** `status_source` = `'email' | 'admin'`.
- `setOrderStatusIfNew` musí zůstat **atomické** (`UPDATE ... WHERE id AND status='new' RETURNING id`); e-mail jen při skutečné změně (volající už to řeší).
- UI a copy v češtině, plná diakritika.
- Lokálně: dev DB (port 5532) NEběží → migraci nelze spustit, jen zapsat/commitnout (deferováno na deploy).
- Práce na větvi `feat/order-status-tracking` (už existuje).

## File Structure

- Create: `db/migrations/006_order_status_tracking.sql` — sloupce `status_changed_at`, `status_source`.
- Modify: `src/app/types.ts` — `Order` o `statusChangedAt`, `statusSource`.
- Modify: `src/app/lib/orders.ts` — `OrderRow`, `mapRow`, `setOrderStatusIfNew(+source)`.
- Modify: `src/app/api/orders/confirm/route.ts` — předat `'email'`.
- Modify: `src/app/api/orders/admin-status/route.ts` — předat `'admin'`.
- Modify: `src/app/admin/page.tsx` — `window.confirm()` + zobrazení času/zdroje v kartě.

---

### Task 1: Migrace — sloupce status_changed_at a status_source

**Files:**
- Create: `db/migrations/006_order_status_tracking.sql`

**Interfaces:**
- Produces: `orders.status_changed_at TIMESTAMPTZ` (nullable), `orders.status_source TEXT` (nullable).

- [ ] **Step 1: Vytvoř migrační soubor**

Soubor `db/migrations/006_order_status_tracking.sql`:

```sql
ALTER TABLE orders ADD COLUMN status_changed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN status_source TEXT;
```

- [ ] **Step 2: Spusť migraci (pokud je DB dostupná)**

Run: `npm run db:migrate`
Expected: `Applying 006_order_status_tracking.sql...` a `Applied ...`, nakonec `Migrations complete.`

Pokud se DB nepřipojí (dev DB na portu 5532 neběží), soubor přesto commitni a report označ jako DONE_WITH_CONCERNS s poznámkou, že migrace neproběhla (spustí se na deploy).

- [ ] **Step 3: Commit**

```bash
git add db/migrations/006_order_status_tracking.sql
git commit -m "feat(db): sloupce status_changed_at a status_source u objednávky"
```

---

### Task 2: Datová vrstva — model, perzistence, routy

**Files:**
- Modify: `src/app/types.ts`
- Modify: `src/app/lib/orders.ts`
- Modify: `src/app/api/orders/confirm/route.ts`
- Modify: `src/app/api/orders/admin-status/route.ts`

**Interfaces:**
- Consumes: sloupce z Tasku 1.
- Produces:
  - `Order` s poli `statusChangedAt: string | null`, `statusSource: 'email' | 'admin' | null`.
  - `setOrderStatusIfNew(id: string, status: Order['status'], source: 'email' | 'admin'): Promise<boolean>` — atomicky zapíše stav + `NOW()` + zdroj.

- [ ] **Step 1: Rozšiř `Order` v `src/app/types.ts`**

V interface `Order` přidej za řádek `token: string;` (a před `createdAt: string;`) dvě pole:

```ts
  statusChangedAt: string | null;
  statusSource: 'email' | 'admin' | null;
```

- [ ] **Step 2: Uprav `OrderRow` a `mapRow` v `src/app/lib/orders.ts`**

V `interface OrderRow` přidej za `created_at: Date;`:

```ts
  status_changed_at: Date | null;
  status_source: string | null;
```

V `mapRow` přidej za řádek `createdAt: row.created_at.toISOString(),`:

```ts
    statusChangedAt: row.status_changed_at ? row.status_changed_at.toISOString() : null,
    statusSource: (row.status_source as Order['statusSource']) ?? null,
```

- [ ] **Step 3: Rozšiř `setOrderStatusIfNew` o zdroj**

Nahraď celou funkci `setOrderStatusIfNew` (a její komentář ponech/aktualizuj):

```ts
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
```

- [ ] **Step 4: Předej zdroj z confirm route**

V `src/app/api/orders/confirm/route.ts` nahraď:

```ts
  const changed = await setOrderStatusIfNew(order.id, 'confirmed');
```

za:

```ts
  const changed = await setOrderStatusIfNew(order.id, 'confirmed', 'email');
```

- [ ] **Step 5: Předej zdroj z admin-status route**

V `src/app/api/orders/admin-status/route.ts` nahraď:

```ts
  const changed = await setOrderStatusIfNew(id, status);
```

za:

```ts
  const changed = await setOrderStatusIfNew(id, status, 'admin');
```

- [ ] **Step 6: Lint + build**

Run: `npm run lint`
Expected: `✔ No ESLint warnings or errors` (kromě pre-existujících `<img>` varování).

Run: `npm run build`
Expected: `✓ Compiled successfully` (žádné TypeScript chyby — `setOrderStatusIfNew` má 3 argumenty na obou volajících místech).

- [ ] **Step 7: Commit**

```bash
git add src/app/types.ts src/app/lib/orders.ts src/app/api/orders/confirm/route.ts src/app/api/orders/admin-status/route.ts
git commit -m "feat(orders): zapisovat čas a zdroj změny stavu objednávky"
```

---

### Task 3: Admin — potvrzovací dialog a zobrazení času/zdroje

**Files:**
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `POST /api/orders/admin-status` (beze změny rozhraní), `Order.statusChangedAt`, `Order.statusSource` (Task 2), existující `showStatus`, `loadOrders`, `orderDate`.

> Pozn.: čísla řádků jsou orientační — kotvi se podle ukázaného kódu.

- [ ] **Step 1: Přidej potvrzovací dialog do `handleOrderStatus`**

Na začátek funkce `handleOrderStatus` (hned po `=> {`, před `const res = await fetch(...)`) přidej:

```ts
    const message =
      status === 'confirmed'
        ? 'Opravdu potvrdit objednávku? Zákazníkovi odejde potvrzovací e-mail.'
        : 'Opravdu zrušit objednávku? Zákazníkovi odejde e-mail o zrušení.';
    if (!window.confirm(message)) return;
```

- [ ] **Step 2: Zobraz čas a zdroj v kartě objednávky**

V náhledu Podle obcí, hned ZA uzavírací `</div>` badge bloku (řádek `<div className="mb-1 flex items-center gap-2">` … který obsahuje jméno + badge a končí `</div>`) a PŘED `<div className="mb-2 text-gray-600">{order.address}</div>`, vlož:

```tsx
                              {order.status !== 'new' && order.statusChangedAt && (
                                <div className="mb-2 text-xs text-gray-500">
                                  {order.status === 'confirmed' ? 'Potvrzeno' : 'Zrušeno'}
                                  {order.statusSource === 'email'
                                    ? ' z e-mailu'
                                    : order.statusSource === 'admin'
                                      ? ' z adminu'
                                      : ''}
                                  {' · '}
                                  {new Date(order.statusChangedAt).toLocaleString('cs-CZ', {
                                    day: 'numeric',
                                    month: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                              )}
```

- [ ] **Step 3: Lint + build**

Run: `npm run lint`
Expected: `✔ No ESLint warnings or errors` (kromě pre-existujících `<img>` varování v `admin/page.tsx`).

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Manuální ověření (volitelné — vyžaduje admin session + DB)**

Po přihlášení do `/admin`, náhled Podle obcí: klik na **Zrušit** vyvolá dialog „Opravdu zrušit…"; po potvrzení se objednávka zruší a v kartě se zobrazí např. „Zrušeno z adminu · 25. 6. 2026 14:32". Klik na **Potvrdit** stejně. Zamítnutí dialogu neudělá nic. (Bez DB ověř jen lint+build a uveď v reportu.)

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat(admin): potvrzovací dialog a zobrazení času/zdroje změny stavu"
```

---

## Závěrečné ověření (po všech taskech)

- [ ] `npm run lint` a `npm run build` projdou (jen pre-existující `<img>` varování).
- [ ] End-to-end manuál (vyžaduje DB): potvrzení z e-mailu → `status_source='email'` + čas; potvrzení/zrušení z adminu (po dialogu) → `'admin'` + čas; karta zobrazí „Potvrzeno/Zrušeno z … · datum čas"; historické objednávky bez času řádek nezobrazí.
- [ ] **Před `gh pr create` spustit `/code-review`** na diff větve a vyřešit nálezy (povinné dle CLAUDE.md).

## Pozn. k nasazení

Po nasazení spustit migraci `006` na VPS (`bash scripts/deploy.sh` ji spustí v rámci `db:migrate`).
