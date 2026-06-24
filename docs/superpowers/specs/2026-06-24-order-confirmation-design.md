# Potvrzování objednávek — návrh

**Datum:** 2026-06-24
**Stav:** schváleno (čeká na plán implementace)

## Cíl

Umožnit hospodě potvrdit příchozí objednávku jídla — z admin panelu i přímo z notifikačního
e-mailu o nové objednávce. Potvrzení označí objednávku jako potvrzenou a pošle zákazníkovi
potvrzovací e-mail. Admin navíc umožní objednávku zrušit (se zasláním e-mailu zákazníkovi).

## Kontext a výchozí stav

- **Objednávky** (`orders`) dnes nemají stav, token ani e-mail zákazníka. Formulář sbírá jméno,
  telefon, adresu, obec, poznámku, den, datum a položky. Notifikace o nové objednávce chodí
  na `ORDER_EMAIL` (hospoda) — sestavuje se inline v `src/app/api/orders/route.ts`.
- **Rezervace** už mají hotový a osvědčený vzor, na kterém tato funkce staví: token-based
  potvrzovací odkaz v e-mailu (`/api/reservations/confirm?token=...`), stav
  `pending | confirmed | cancelled`, admin zrušení přes ID (`/api/reservations/admin-cancel`).
- **Objednávkový formulář** (`OrderForm.tsx`) je vložený v `WeeklyMenuTabs.tsx` na homepage
  (kotva `#objednavka`). Samostatná stránka `/objednavka` **neexistuje**.
- V projektu **není testovací framework**. Ověření = `npm run build`, `npm run lint`
  a manuální průchod flow.

## Rozhodnutí (odsouhlasená se zadavatelem)

1. **E-mail zákazníka je povinný** — přidá se do objednávkového formuláře jako povinné pole.
2. **Stavy objednávky:** `new → confirmed`, plus možnost **zrušit** (`cancelled`).
3. **Zrušení posílá zákazníkovi e-mail** o zrušení objednávky.
4. Cíl potvrzovacího odkazu z e-mailu = **dedikovaná výsledková stránka** `/objednavka/potvrzeno`.
5. Notifikační e-mail o nové objednávce se **přesune z routy do `email.ts`** (centralizace).

## Změny po komponentách

### 1. Migrace — `db/migrations/004_order_confirmation.sql`

Přidat do tabulky `orders`:

- `email TEXT` — nullable v DB (historické řádky e-mail nemají); v aplikaci povinný u nových objednávek.
- `status TEXT NOT NULL DEFAULT 'new'` — hodnoty `new | confirmed | cancelled`.
- `token TEXT UNIQUE` — náhodný token pro potvrzovací odkaz v e-mailu (nullable kvůli historickým řádkům).

V téže migraci nastavit existující řádky na `status = 'confirmed'`, aby se historické objednávky
netvářily jako nevyřízené (běží jen jednorázově při aplikaci migrace; nové inserty dostanou
default `new`).

### 2. Typy — `src/app/types.ts`

`Order` rozšířit o:

```ts
email: string;
status: 'new' | 'confirmed' | 'cancelled';
token: string;
```

### 3. Formulář — `src/app/components/OrderForm.tsx`

- Přidat povinné pole **E-mail** (`type="email"`, `required`), stav `email`.
- Klientská validace formátu e-mailu před odesláním (jednoduchý regex, hláška česky).
- Posílat `email` v POST body.
- Po úspěšném odeslání resetovat i pole e-mailu.
- GDPR souhlas v formuláři už e-mail pokrývá (text „zpracováním osobních údajů za účelem
  vyřízení objednávky").

### 4. Lib — `src/app/lib/orders.ts`

- `createOrder` — ukládat `email`, `status`, `token` (rozšířit INSERT).
- `mapRow` — mapovat `email`, `status`, `token` z řádku.
- Nové funkce:
  - `findOrderById(id: string): Promise<Order | null>`
  - `findOrderByToken(token: string): Promise<Order | null>`
  - `updateOrderStatus(id: string, status: Order['status']): Promise<void>`

### 5. E-maily — `src/app/lib/email.ts`

Přesunout sestavení notifikačního e-mailu z `orders/route.ts` sem a doplnit potvrzovací tlačítko.
Nové funkce (styl HTML konzistentní s existujícími rezervačními e-maily):

- `sendOrderNotification(order: Order)` — komu: `ORDER_EMAIL`. Obsahuje detail objednávky
  (jako dnešní notifikace) **+ tlačítko „Potvrdit objednávku"** s odkazem
  `${BASE_URL}/api/orders/confirm?token=${order.token}`. `replyTo` = e-mail zákazníka.
  Pokud `ORDER_EMAIL` nebo `RESEND_API_KEY` chybí, funkce tiše nic nepošle (zachovat dnešní chování).
- `sendOrderConfirmedEmail(order: Order)` — komu: `order.email`. Předmět „Objednávka potvrzena —
  Hospoda Na Palouku". Obsah: poděkování, položky + celková cena, den/datum doručení.
- `sendOrderCancelledEmail(order: Order)` — komu: `order.email`. Předmět „Objednávka zrušena —
  Hospoda Na Palouku". Zdvořilé oznámení o zrušení.

Helper pro výpočet celkové ceny (`order.items.reduce(...)`) sdílet uvnitř `email.ts`.

### 6. API routy

- **`POST /api/orders`** (`src/app/api/orders/route.ts`):
  - Validovat `email` jako povinný (vedle stávajících polí).
  - Vygenerovat `token` (`randomUUID()`), `status = 'new'`.
  - Uložit přes `createOrder`.
  - Odeslat `sendOrderNotification(order)` (nahradí dnešní inline sestavení e-mailu).

- **`GET /api/orders/confirm?token=...`** (nová `src/app/api/orders/confirm/route.ts`):
  - **Bez autentizace** (klik z e-mailu hospody; token je ochrana).
  - `findOrderByToken`. Logika (zrcadlí rezervační confirm):
    - token chybí / nenalezeno → redirect `/objednavka/potvrzeno?status=notfound`
    - `status === 'cancelled'` → redirect `/objednavka/potvrzeno?status=cancelled`
    - `status === 'confirmed'` → redirect `/objednavka/potvrzeno?status=already` (bez opětovného e-mailu)
    - jinak → `updateOrderStatus(id, 'confirmed')` + `sendOrderConfirmedEmail` (v try/catch) →
      redirect `/objednavka/potvrzeno?status=confirmed`

- **`POST /api/orders/admin-status`** (nová `src/app/api/orders/admin-status/route.ts`):
  - **Vyžaduje auth** (`isAuthenticated`).
  - Body `{ id, status }`, kde `status ∈ {'confirmed','cancelled'}` (jinak 400).
  - `findOrderById`; pokud nenalezeno → 404.
  - Pokud `order.status === status` → no-op, vrátit `{ ok: true }` (idempotence, žádný duplicitní e-mail).
  - Jinak `updateOrderStatus` + odeslat odpovídající e-mail zákazníkovi
    (`sendOrderConfirmedEmail` / `sendOrderCancelledEmail`) v try/catch.

### 7. Výsledková stránka — `src/app/objednavka/potvrzeno/page.tsx`

Malá stránka (cíl redirectu z confirm routy; `/objednavka` jinak neexistuje). Čte `?status=` a zobrazí:

- `confirmed` → „Objednávka byla potvrzena. Zákazníkovi jsme poslali potvrzovací e-mail."
- `already` → „Tato objednávka už byla potvrzena dříve."
- `cancelled` → „Tuto objednávku nelze potvrdit — byla zrušena."
- `notfound` / jiné → „Objednávka nenalezena."

Vizuálně střídmé, konzistentní se zbytkem webu, odkaz zpět na homepage.

### 8. Admin — `src/app/admin/page.tsx`

V náhledu **Podle obcí** (`orderView === 'village'`) u každé karty objednávky:

- **Badge stavu**: Nová (žlutá) / Potvrzená (zelená) / Zrušená (šedá, karta ztlumená).
- U `status === 'new'`: tlačítka **Potvrdit** (zelené) a **Zrušit** (červené).
- Handler `handleOrderStatus(id, status)` → `POST /api/orders/admin-status` → po úspěchu
  `loadOrders(orderDate)` (a `loadOrderCounts()` pokud je relevantní).
- **Souhrn** (`orderView === 'summary'`): agregace položek (`orderSummary`) **vynechá zrušené**
  objednávky (`status !== 'cancelled'`), aby „co se vaří" nezapočítávalo zrušené.

Náhled Podle obcí ponechá i zrušené objednávky viditelné (ztlumené) kvůli historii.

### 9. GDPR — `src/app/ochrana-osobnich-udaju/page.tsx`

Doplnit **e-mail** mezi sbírané osobní údaje u objednávek (dnes tam u objednávek e-mail není).

## Mimo rozsah (YAGNI)

- Reject/zrušení přímo z notifikačního e-mailu (admin to umí).
- Automatické mazání nebo expirace objednávek.
- Změny v `orders/counts` (počty v date-selectoru) — zůstávají jako celkové počty.
- Potvrzování v náhledu Souhrn (potvrzení je per-objednávka, patří do náhledu Podle obcí).

## Datový tok

1. Zákazník odešle objednávku (vč. e-mailu) → `POST /api/orders` uloží `status='new'` + `token`,
   pošle hospodě notifikaci s tlačítkem Potvrdit.
2. Hospoda potvrdí buď:
   - **z e-mailu**: `GET /api/orders/confirm?token=...` → `confirmed` + e-mail zákazníkovi → stránka výsledku;
   - **z adminu**: `POST /api/orders/admin-status {confirmed}` → `confirmed` + e-mail zákazníkovi.
3. Hospoda může v adminu objednávku **zrušit**: `POST /api/orders/admin-status {cancelled}` →
   `cancelled` + e-mail zákazníkovi o zrušení.

## Bezpečnost

- Confirm odkaz z e-mailu je neautentizovaný, chráněný náhodným `token` (UUID). Notifikace chodí
  do interní schránky hospody (`ORDER_EMAIL`) — stejný/silnější trust model než u rezervací.
- Admin akce vyžadují platnou session (`isAuthenticated`).
- Idempotence brání duplicitním e-mailům při opakovaném kliknutí/akci.

## Ověření (žádný test framework)

- `npm run lint` a `npm run build` musí projít.
- Manuální průchod: vytvoření objednávky s e-mailem → příchod notifikace s tlačítkem →
  potvrzení z e-mailu i z adminu → kontrola potvrzovacího e-mailu zákazníkovi → zrušení z adminu
  → kontrola e-mailu o zrušení → idempotence (druhý klik nic nepošle) → souhrn vynechává zrušené.
- Migrace: `npm run db:migrate` proběhne čistě; existující objednávky dostanou `confirmed`.

## Proměnné prostředí

Beze změny — využívá stávající `RESEND_API_KEY`, `ORDER_EMAIL`, `NEXT_PUBLIC_BASE_URL`.
