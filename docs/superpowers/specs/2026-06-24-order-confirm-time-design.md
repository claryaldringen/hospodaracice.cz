# Konfigurovatelný čas potvrzení objednávky — návrh

**Datum:** 2026-06-24
**Stav:** schváleno (čeká na plán implementace)

## Cíl

Přidat do adminu konfigurovatelné pole s časem (default `16:00`), do kdy hospoda objednávku
potvrdí. Tento čas se po odeslání objednávky zobrazí zákazníkovi v hlášce, spolu s jeho e-mailem.

## Kontext a výchozí stav

- Admin konfigurace má v projektu zavedený vzor `opening_hours`: jednořádková tabulka
  (`id = 1` s CHECK) + route `GET` (veřejné) / `POST` (admin, `isAuthenticated`), upsert přes
  `INSERT ... ON CONFLICT (id) DO UPDATE`. Stejně funguje i `delivery_villages` (GET veřejné /
  POST admin). Tento vzor použijeme.
- „Toast" po objednání je ve skutečnosti existující inline zelený box v `OrderForm.tsx`
  (`result.text`), který se po úspěšném odeslání zobrazí a stránka odscrolluje nahoru
  (`window.scrollTo`). Jen do něj dáme nový text.
- `OrderForm.tsx` už si při načtení vyzvedává obce z `/api/delivery-villages` — stejným způsobem
  si vyzvedne i čas potvrzení.
- Telefonní čísla jsou natvrdo v `Footer.tsx` (`+420 702 181 247`, `+420 603 263 291`). Hláška
  na ně odkazuje obecně, čísla se do hlášky nevkládají.

## Rozhodnutí (odsouhlasená se zadavatelem)

1. Čas je **jedna globální hodnota** (ne per-den ani per-objednávka).
2. Konfigurovatelný je **jen čas**; znění hlášky je natvrdo, dosazuje se do něj e-mail + čas.
3. Telefon v hlášce: **obecné znění** „zde uvedené telefonní číslo" (bez konkrétního čísla).
4. Pole v adminu je umístěno **v kartě Objednávky**.

## Změny po komponentách

### 1. Migrace — `db/migrations/005_order_settings.sql`

```sql
CREATE TABLE order_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    confirm_time TEXT NOT NULL DEFAULT '16:00'
);
INSERT INTO order_settings (id) VALUES (1);
```

Jednořádková tabulka, zrcadlí `opening_hours`. `confirm_time` ve formátu `HH:MM`.

### 2. API — `src/app/api/order-settings/route.ts`

Zrcadlí `src/app/api/opening-hours/route.ts`:

- **GET** (veřejné): `SELECT confirm_time FROM order_settings WHERE id = 1`; vrátí
  `{ confirmTime: row?.confirm_time ?? '16:00' }`.
- **POST** (admin, `isAuthenticated`): tělo `{ confirmTime }`. Validace formátu `HH:MM`
  (regex `^([01]\d|2[0-3]):[0-5]\d$`) → při neplatném 400. Upsert
  `INSERT INTO order_settings (id, confirm_time) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET confirm_time = $1`.
  Vrátí `{ ok: true }`.

### 3. Admin — `src/app/admin/page.tsx`

V kartě **Objednávky** (sekce `{/* Orders */}`), v hlavičce karty vedle/nad výběrem data:

- Stav `confirmTime` (string, init `'16:00'`) a `savedConfirmTime`.
- Načtení po přihlášení: `GET /api/order-settings` → `setConfirmTime(data.confirmTime)`
  (přidat do existující auth-gated load logiky).
- UI: label „Potvrdit nejpozději v:", `<input type="time">` navázaný na `confirmTime`,
  tlačítko **Uložit** → `handleSaveConfirmTime` (`POST /api/order-settings`), po úspěchu
  `showStatus('success', ...)` a `setSavedConfirmTime`.
- Styl konzistentní s ostatními admin prvky (vzor `handleSaveOpeningHours`).

### 4. Objednávkový formulář — `src/app/components/OrderForm.tsx`

- Stav `confirmTime` (string, init `'16:00'` jako fallback).
- Při načtení vyzvednout `GET /api/order-settings` a uložit `confirmTime` (rozšířit existující
  `loadVillages` flow nebo přidat vedle něj samostatný fetch).
- Po úspěšném odeslání nastavit `result.text` na (jednoduchý text, bez HTML — box renderuje
  prostý řetězec):

  > Děkujeme za Vaši objednávku. Objednávku vám potvrdíme na e-mail {email} nejpozději
  > v {confirmTime}. Pokud vám potvrzení nepřijde, zavolejte nám prosím na zde uvedené
  > telefonní číslo.

  kde `{email}` je e-mail z formuláře a `{confirmTime}` načtená hodnota. Zachovat stávající
  `window.scrollTo({ top: 0 })` a reset polí.

## Datový tok

1. Admin nastaví čas v kartě Objednávky → `POST /api/order-settings` uloží `confirm_time`.
2. Zákazník otevře formulář → `GET /api/order-settings` načte aktuální `confirmTime`.
3. Zákazník odešle objednávku → po úspěchu se zobrazí hláška s jeho e-mailem a načteným časem.

## Mimo rozsah (YAGNI)

- Editovatelné znění celé hlášky (konfigurovatelný je jen čas).
- Per-den nebo per-objednávka časy.
- Vkládání konkrétního telefonního čísla do hlášky.

## Ověření (žádný test framework)

- `npm run lint` a `npm run build` projdou.
- Manuální: v adminu změnit čas → uložit → načíst formulář → odeslat objednávku → hláška
  obsahuje správný e-mail a nastavený čas. Neplatný formát času přes POST vrátí 400.
- Migrace `005` proběhne čistě (`npm run db:migrate`); tabulka má jeden řádek s `16:00`.

## Proměnné prostředí

Beze změny.

## Pozn. k nasazení

Po nasazení spustit migraci `005` na VPS (`npm run db:migrate`, skill `vps-devops`).
Pozn.: na produkci stále čeká i spuštění migrace `004` z předchozí feature (potvrzování objednávek).
