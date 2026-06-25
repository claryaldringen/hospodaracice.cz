# Čas a zdroj změny stavu objednávky + potvrzovací dialogy — návrh

**Datum:** 2026-06-25
**Stav:** schváleno (čeká na plán implementace)

## Cíl

1. Zaznamenat a v adminu zobrazit, **kdy** došlo ke změně stavu objednávky (potvrzení/zrušení)
   a **z jakého zdroje** (z e-mailu vs. z adminu).
2. Přidat **potvrzovací dialog** před potvrzením i zrušením objednávky v adminu — obě akce
   posílají zákazníkovi e-mail a jsou jednorázové, takže omylný klik má reálný dopad.

## Kontext a výchozí stav

- `Order` má dnes `status` (`new | confirmed | cancelled`), `createdAt` a `token`, ale **žádný
  čas změny stavu ani zdroj**. Migrace `004` přidala `email/status/token`.
- Stav objednávky se mění atomicky přes `setOrderStatusIfNew(id, status)` v `src/app/lib/orders.ts`
  (`UPDATE ... WHERE id AND status='new' RETURNING id`), volané ze dvou míst:
  - `GET /api/orders/confirm` — potvrzení z e-mailového odkazu (bez auth, token),
  - `POST /api/orders/admin-status` — potvrzení/zrušení z adminu (auth).
- Admin (`src/app/admin/page.tsx`) v náhledu **Podle obcí** zobrazuje u objednávky badge stavu;
  `handleOrderStatus(id, status)` volá `admin-status` **bez** potvrzovacího dialogu.
- Admin je client component → `toLocaleString('cs-CZ', …)` poběží v prohlížeči (český čas).

## Rozhodnutí (odsouhlasená se zadavatelem)

1. Dialog (nativní `window.confirm()`) **u Potvrdit i Zrušit**.
2. Zaznamenávat **čas** (`status_changed_at`) i **zdroj** (`status_source` = `email | admin`).
3. Zdroj se zaznamenává u každé změny stavu z `new` (potvrzení i zrušení).

## Změny po komponentách

### 1. Migrace — `db/migrations/006_order_status_tracking.sql`

```sql
ALTER TABLE orders ADD COLUMN status_changed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN status_source TEXT;
```

Bez backfillu — historické řádky zůstanou `NULL` (čas/zdroj neznámé). Bez `CHECK` na
`status_source` (konzistentní se sloupcem `status`, který CHECK také nemá).

### 2. Datový model — `src/app/types.ts`

`Order` rozšířit o:

```ts
statusChangedAt: string | null;
statusSource: 'email' | 'admin' | null;
```

### 3. Lib — `src/app/lib/orders.ts`

- `OrderRow` doplnit `status_changed_at: Date | null`, `status_source: string | null`.
- `mapRow` mapovat:
  - `statusChangedAt: row.status_changed_at ? row.status_changed_at.toISOString() : null`
  - `statusSource: (row.status_source as Order['statusSource']) ?? null`
- `setOrderStatusIfNew` rozšířit o parametr `source: 'email' | 'admin'` a atomicky zapsat čas i zdroj:

```ts
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

### 4. API

- `src/app/api/orders/confirm/route.ts` — volat `setOrderStatusIfNew(order.id, 'confirmed', 'email')`.
- `src/app/api/orders/admin-status/route.ts` — volat `setOrderStatusIfNew(id, status, 'admin')`.

(Ostatní logika obou rout beze změny — idempotence, e-maily jen při skutečné změně.)

### 5. Admin — `src/app/admin/page.tsx`

**Potvrzovací dialog** v `handleOrderStatus`:

```ts
const handleOrderStatus = async (id: string, status: 'confirmed' | 'cancelled') => {
  const message =
    status === 'confirmed'
      ? 'Opravdu potvrdit objednávku? Zákazníkovi odejde potvrzovací e-mail.'
      : 'Opravdu zrušit objednávku? Zákazníkovi odejde e-mail o zrušení.';
  if (!window.confirm(message)) return;
  // … stávající fetch …
};
```

**Zobrazení času + zdroje** v kartě objednávky (náhled Podle obcí): pod badge stavu přidat řádek
pro `order.status !== 'new' && order.statusChangedAt`:

- text stavu: `Potvrzeno` / `Zrušeno` dle `order.status`,
- zdroj: `statusSource === 'email'` → „z e-mailu", `=== 'admin'` → „z adminu", `null` → bez zdroje,
- čas: `new Date(order.statusChangedAt).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })`.

Výsledek např.: **„Potvrzeno z e-mailu · 25. 6. 2026 14:32"**. Historické objednávky (bez
`statusChangedAt`) řádek nezobrazí — zůstane jen badge.

## Datový tok

1. Potvrzení z e-mailu → confirm route → `setOrderStatusIfNew(id,'confirmed','email')` zapíše stav,
   `NOW()` a `email`.
2. Potvrzení/zrušení z adminu → po `window.confirm` → admin-status route →
   `setOrderStatusIfNew(id, status, 'admin')`.
3. Admin při načtení objednávek dostane `statusChangedAt` + `statusSource` a zobrazí je v kartě.

## Mimo rozsah (YAGNI)

- Rezervace (jiný flow).
- Zpětné dopočítání zdroje/času u historických objednávek.
- `CHECK` constraint na `status_source`.
- Zobrazení času/zdroje v náhledu Souhrn (per-objednávka info patří do náhledu Podle obcí).

## Ověření (žádný test framework)

- `npm run lint` + `npm run build` projdou.
- Manuální (vyžaduje DB): potvrzení z adminu i z e-mailu zapíše správný čas a zdroj; v kartě se
  zobrazí „Potvrzeno z … · datum čas"; zrušení vyžaduje potvrzení dialogu a zapíše `admin`;
  zamítnutí dialogu neudělá nic.
- Migrace `006` proběhne čistě; existující objednávky mají `status_changed_at`/`status_source` NULL.

## Proměnné prostředí

Beze změny.

## Pozn. k nasazení

Po nasazení spustit migraci `006` na VPS (`bash scripts/deploy.sh` ji spustí v rámci `db:migrate`).
