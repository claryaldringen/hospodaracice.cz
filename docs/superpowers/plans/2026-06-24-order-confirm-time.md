# Konfigurovatelný čas potvrzení objednávky — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Přidat do adminu konfigurovatelný čas (default 16:00), do kdy bude objednávka potvrzena, a zobrazit ho zákazníkovi v hlášce po odeslání objednávky.

**Architecture:** Jednořádková tabulka `order_settings` (vzor `opening_hours`) + route `GET` (veřejné) / `POST` (admin) na `/api/order-settings`. Admin čas edituje v kartě Objednávky; objednávkový formulář si ho při načtení vyzvedne a po úspěšném odeslání ho s e-mailem zákazníka vloží do hlášky.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, PostgreSQL (`pg`).

## Global Constraints

- **Next.js 15 App Router**, TypeScript, path alias `@/*` → `./src/*`.
- **Žádný testovací framework** — ověření každého tasku = `npm run lint` (bez warnings/errors kromě pre-existujících `<img>` varování v `admin/page.tsx` a `Gallery.tsx`) + `npm run build` (compiled successfully) + manuál. Nezavádět test framework.
- **Čas je jedna globální hodnota** ve formátu `HH:MM`, default `'16:00'`.
- **Konfigurovatelný je jen čas**; znění hlášky je natvrdo (dosadí se e-mail + čas).
- **Telefon v hlášce:** obecné znění „zde uvedené telefonní číslo", bez konkrétního čísla.
- **Admin POST validuje formát** `HH:MM` regexem `^([01]\d|2[0-3]):[0-5]\d$`.
- Práce probíhá na větvi `feat/order-confirm-time` (už existuje).
- Lokálně: DATABASE_URL je v `.env`, ale dev DB (port 5532) NEběží → migraci nelze spustit lokálně; soubor se vytvoří a commitne, spuštění se odloží na deploy.

## File Structure

- Create: `db/migrations/005_order_settings.sql` — tabulka `order_settings`.
- Create: `src/app/api/order-settings/route.ts` — GET (veřejné) / POST (admin).
- Modify: `src/app/admin/page.tsx` — stav + načtení + uložení + pole v kartě Objednávky.
- Modify: `src/app/components/OrderForm.tsx` — načtení času + hláška po odeslání.

---

### Task 1: Migrace — tabulka `order_settings`

**Files:**
- Create: `db/migrations/005_order_settings.sql`

**Interfaces:**
- Produces: tabulka `order_settings (id, confirm_time TEXT NOT NULL DEFAULT '16:00')` s jedním řádkem `id = 1`.

- [ ] **Step 1: Vytvoř migrační soubor**

Soubor `db/migrations/005_order_settings.sql`:

```sql
CREATE TABLE order_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    confirm_time TEXT NOT NULL DEFAULT '16:00'
);
INSERT INTO order_settings (id) VALUES (1);
```

- [ ] **Step 2: Spusť migraci (pokud je DB dostupná)**

Run: `npm run db:migrate`
Expected: `Applying 005_order_settings.sql...` a `Applied 005_order_settings.sql`, nakonec `Migrations complete.`

Pokud se DB nepodaří připojit (dev DB na portu 5532 neběží), soubor přesto commitni a v reportu uveď, že migrace nebyla spuštěna (Status DONE_WITH_CONCERNS).

- [ ] **Step 3: Commit**

```bash
git add db/migrations/005_order_settings.sql
git commit -m "feat(db): tabulka order_settings pro čas potvrzení objednávky"
```

---

### Task 2: API — `/api/order-settings`

**Files:**
- Create: `src/app/api/order-settings/route.ts`

**Interfaces:**
- Consumes: tabulka `order_settings` (Task 1); `isAuthenticated` z `@/app/lib/auth`; `query`, `queryOne` z `@/app/lib/db`.
- Produces:
  - `GET /api/order-settings` → `{ confirmTime: string }` (default `'16:00'`).
  - `POST /api/order-settings` (admin) s body `{ confirmTime: string }` → `{ ok: true }`; 401 bez auth; 400 při neplatném formátu.

- [ ] **Step 1: Vytvoř route**

Soubor `src/app/api/order-settings/route.ts` (zrcadlí `src/app/api/opening-hours/route.ts`):

```ts
import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/app/lib/auth';
import { query, queryOne } from '@/app/lib/db';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GET() {
  const row = await queryOne<{ confirm_time: string }>(
    'SELECT confirm_time FROM order_settings WHERE id = 1'
  );
  return NextResponse.json({ confirmTime: row?.confirm_time ?? '16:00' });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { confirmTime } = await req.json();

  if (typeof confirmTime !== 'string' || !TIME_RE.test(confirmTime)) {
    return NextResponse.json({ error: 'Neplatný formát času (HH:MM).' }, { status: 400 });
  }

  await query(
    'INSERT INTO order_settings (id, confirm_time) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET confirm_time = $1',
    [confirmTime]
  );

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint`
Expected: `✔ No ESLint warnings or errors` (kromě pre-existujících `<img>` varování).

Run: `npm run build`
Expected: `✓ Compiled successfully`; v seznamu rout se objeví `/api/order-settings`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/order-settings/route.ts
git commit -m "feat(api): order-settings GET/POST pro čas potvrzení"
```

---

### Task 3: Admin — pole s časem v kartě Objednávky

**Files:**
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/order-settings` (Task 2); existující `showStatus`, `useState`, `useCallback`, `useEffect`.

> Pozn.: čísla řádků níže jsou orientační (soubor se během tasku posouvá) — kotvi se podle ukázaného kódu.

- [ ] **Step 1: Přidej stav pro čas**

Za řádek `const [orderCounts, setOrderCounts] = useState<Record<string, number>>({});` (řádek ~46) přidej:

```tsx
  const [confirmTime, setConfirmTime] = useState('16:00');
  const [savedConfirmTime, setSavedConfirmTime] = useState('16:00');
```

- [ ] **Step 2: Přidej načítání nastavení a zavolej ho po přihlášení**

Hned za existující useEffect, který načítá objednávky (blok končící `}, [isAuthenticated, orderDate, loadOrders, loadOrderCounts]);`, řádek ~325), přidej callback i efekt:

```tsx
  const loadOrderSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/order-settings');
      if (res.ok) {
        const data = await res.json();
        setConfirmTime(data.confirmTime);
        setSavedConfirmTime(data.confirmTime);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadOrderSettings();
  }, [isAuthenticated, loadOrderSettings]);
```

- [ ] **Step 3: Přidej handler pro uložení**

Hned za funkci `handleSaveOpeningHours` (končí na řádku ~357) přidej:

```tsx
  const handleSaveConfirmTime = async () => {
    try {
      const res = await fetch('/api/order-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmTime }),
      });
      if (res.ok) {
        setSavedConfirmTime(confirmTime);
        showStatus('success', 'Čas potvrzení uložen!');
      } else {
        showStatus('error', 'Chyba při ukládání času potvrzení.');
      }
    } catch {
      showStatus('error', 'Chyba při ukládání času potvrzení.');
    }
  };
```

- [ ] **Step 4: Přidej pole do karty Objednávky**

V sekci `{/* Orders */}` je hlavička karty (`<div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">` s `<h2>Objednávky</h2>` a `<select>` pro datum), která končí `</div>` (řádek ~924). Hned ZA tento uzavírací `</div>` hlavičky (a PŘED blok `{/* View toggle */}`) vlož konfigurační řádek:

```tsx
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
            <label htmlFor="confirm-time" className="text-sm text-gray-600">
              Potvrdit nejpozději v:
            </label>
            <input
              id="confirm-time"
              type="time"
              value={confirmTime}
              onChange={(e) => setConfirmTime(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              onClick={handleSaveConfirmTime}
              disabled={confirmTime === savedConfirmTime}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Uložit
            </button>
          </div>
```

- [ ] **Step 5: Lint + build**

Run: `npm run lint`
Expected: `✔ No ESLint warnings or errors` (kromě pre-existujících `<img>` varování v `admin/page.tsx`).

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 6: Manuální ověření (volitelné — vyžaduje admin session + DB)**

Po přihlášení do `/admin` je v kartě Objednávky pole „Potvrdit nejpozději v:" s aktuální hodnotou; změna + Uložit zobrazí hlášku „Čas potvrzení uložen!". (Vyžaduje běžící DB; pokud není, ověř jen lint+build a uveď v reportu.)

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat(admin): nastavení času potvrzení v kartě Objednávky"
```

---

### Task 4: Objednávkový formulář — hláška s časem a e-mailem

**Files:**
- Modify: `src/app/components/OrderForm.tsx`

**Interfaces:**
- Consumes: `GET /api/order-settings` (Task 2).

> Pozn.: čísla řádků jsou orientační — kotvi se podle ukázaného kódu.

- [ ] **Step 1: Přidej stav `confirmTime`**

Za řádek `const [submitting, setSubmitting] = useState(false);` (řádek ~21) přidej:

```tsx
  const [confirmTime, setConfirmTime] = useState('16:00');
```

- [ ] **Step 2: Načti čas při mountu**

Hned za existující `useEffect(() => { loadVillages(); }, [loadVillages]);` (řádek ~37) přidej:

```tsx
  useEffect(() => {
    fetch('/api/order-settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.confirmTime) setConfirmTime(data.confirmTime);
      })
      .catch(() => {});
  }, []);
```

- [ ] **Step 3: Nahraď text úspěšné hlášky**

V `handleSubmit`, v success větvi, nahraď řádek
`setResult({ type: 'success', text: 'Objednávka odeslána!' });` (řádek ~111) tímto:

```tsx
        setResult({
          type: 'success',
          text: `Děkujeme za Vaši objednávku. Objednávku vám potvrdíme na e-mail ${email} nejpozději v ${confirmTime}. Pokud vám potvrzení nepřijde, zavolejte nám prosím na zde uvedené telefonní číslo.`,
        });
```

(`email` je stav formuláře a je v této closure stále vyplněný — reset polí proběhne až za tímto řádkem, takže se do hlášky dosadí zadaný e-mail.)

- [ ] **Step 4: Lint + build**

Run: `npm run lint`
Expected: `✔ No ESLint warnings or errors`.

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 5: Manuální ověření (volitelné — vyžaduje DB)**

Spusť `npm run dev`, otevři homepage, vyber den a jídlo, vyplň e-mail a odešli → v zeleném boxu se zobrazí hláška obsahující zadaný e-mail a načtený čas potvrzení. (Vyžaduje běžící DB; jinak ověř jen lint+build a uveď v reportu.)

- [ ] **Step 6: Commit**

```bash
git add src/app/components/OrderForm.tsx
git commit -m "feat(orders): hláška po objednání s časem potvrzení a e-mailem"
```

---

## Závěrečné ověření (po všech taskech)

- [ ] `npm run lint` a `npm run build` projdou (jen pre-existující `<img>` varování).
- [ ] End-to-end manuál (vyžaduje DB): admin nastaví čas → formulář ho načte → po odeslání hláška obsahuje e-mail + čas; neplatný formát přes POST vrátí 400.
- [ ] **Před `gh pr create` spustit `/code-review`** na diff větve (`origin/main...HEAD`) a vyřešit nálezy (povinné dle CLAUDE.md).

## Pozn. k nasazení

Po nasazení spustit migraci `005` na VPS (`npm run db:migrate`, skill `vps-devops`).
Pozn.: na produkci stále čeká i migrace `004` z předchozí feature.
