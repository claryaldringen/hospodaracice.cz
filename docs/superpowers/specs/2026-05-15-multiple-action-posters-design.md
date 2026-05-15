# Sekce „Akce" — víc plakátů vedle sebe

**Datum:** 2026-05-15
**Status:** Schválený design

## Kontext a motivace

Sekce „Akce" na homepage dnes podporuje právě jeden plakát (`action.webp`). Hospoda potřebuje souběžně zobrazovat víc plakátů na různé akce (koncerty, pivní slavnosti, sezónní speciály). Konvence `permanent1..4` s pevnými sloty se sem nehodí — počet akcí je proměnlivý a admin chce ovládat pořadí.

Cílem je nahradit jeden slot flexibilním seznamem plakátů s manuálním řazením v adminu (drag-and-drop) a responzivním layoutem na public stránce (na desktopu se vejde, kolik se vejde; na mobilu horizontální swipe).

## Datový model

Nová tabulka v PostgreSQL (kopíruje konvenci `gallery`):

```sql
CREATE TABLE action_posters (
  id          SERIAL PRIMARY KEY,
  filename    TEXT NOT NULL,
  position    INTEGER NOT NULL,
  alt_text    TEXT NOT NULL DEFAULT 'Plakát akce',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_action_posters_position ON action_posters (position);
```

**Klíčové vlastnosti:**

- `filename` je vázaný na `id` (`action-{id}.webp`), ne na pořadí — soubory se při reorderu nepřejmenovávají.
- `position` je celé číslo 1..N. Po DELETE se v transakci přečísluje na 1..N, aby nezůstaly díry.
- `alt_text` má rozumný default; admin ho může přepsat, ale nemusí.

Starý `'action'` typ z `IMAGE_TYPES` (`src/app/types.ts`) se odstraní. Stávající `menu_images` řádek pro action se v seed migraci smaže.

## API

Nové endpointy v `src/app/api/action-posters/`:

| Metoda | Cesta | Auth | Účel |
|---|---|---|---|
| `GET` | `/api/action-posters` | veřejné | seznam plakátů řazený dle `position` (pro klient-side revalidaci v adminu) |
| `POST` | `/api/action-posters` | admin | upload nového plakátu (multipart), zapíše na konec, vrátí `{id, position, filename, altText}` |
| `DELETE` | `/api/action-posters/[id]` | admin | smaže soubor z disku + řádek z DB, přečísluje `position` v transakci |
| `PATCH` | `/api/action-posters/order` | admin | tělo `{ ids: number[] }` v novém pořadí, atomicky přepíše `position` |
| `PATCH` | `/api/action-posters/[id]` | admin | volitelný update `alt_text` |

**Detaily:**

- Homepage (`src/app/page.tsx`) čte tabulku přímo přes `query()`, ne přes `fetch`.
- `POST` přijme již zkonvertovaný WebP buffer (klient-side konverze přes canvas, stejně jako stávající admin upload). Server jen uloží na disk a vrátí metadata.
- Filename se generuje ze sekvence `id` vrácené z `INSERT ... RETURNING id`. Soubor se zapisuje až po úspěšném INSERTu, aby se nestalo, že soubor existuje bez DB řádku (při chybě se file případně neuloží — řádek bude osiřelý, opačně je horší).
- Reorder PATCH validuje, že `ids` obsahuje právě všechny existující ID (žádné chybějící, žádné navíc).

## Frontend komponenty

### Public: `src/app/components/ActionPosters.tsx`

Nahrazuje stávající `<section id="action">` v `MenuImages.tsx`. V `MenuImages.tsx`:

```tsx
{visibleSections.action && <ActionPosters posters={actionPosters} />}
```

Vnitřek:

- **Desktop (≥ md):** CSS grid `grid-cols-[repeat(auto-fit,minmax(280px,1fr))]`, `gap-4`, `align-items: start`. Plakát: `<img className="object-contain max-h-[80vh] w-full">`.
- **Mobile (< md):** `flex overflow-x-auto snap-x snap-mandatory gap-3`. Každý plakát `min-w-[80vw] snap-center`. Peek na sousední plakáty ≈ 10 % vlevo/vpravo.
- Žádný JS framework pro carousel — čistě CSS scroll-snap.
- `alt` z `poster.altText`. Pod sekcí `<div className="sr-only">` se seznamem všech akcí.

Komponenta je server component (žádný klient-side state). Sekce se nevyrenderuje pokud `posters.length === 0`.

### Admin: `src/app/admin/ActionPostersAdmin.tsx` (client component)

Nahrazuje stávající single-slot „Akce" sekci v `admin/page.tsx`.

Layout:
- Nahoře tlačítko **„+ Přidat plakát"** → file picker → klient-side WebP konverze (přes stávající helper) → `POST /api/action-posters` → append do lokálního state.
- Pod tím vertikální `SortableContext` z `@dnd-kit/sortable`. Každý řádek (`SortableItem`):
  - Drag handle (`≡`) vlevo (touch + keyboard via `KeyboardSensor`)
  - Thumbnail (~120 px, lazy)
  - `<details>` s collapsed alt-text inputem (volitelné)
  - Tlačítko ✕ smazat s `confirm()`
- `onDragEnd`: lokálně reorder → `PATCH /api/action-posters/order` s novým pořadím ID. Při chybě rollback.
- Po úspěšném DELETE: lokálně odebrat + refetch order (server ho přečísloval).

Optimistické UI, ale s revertem při chybě.

## Layout — vizuální specifikace

(Schváleno přes brainstorming visual companion, mockup files v `.superpowers/brainstorm/.../content/`.)

- **Desktop:** auto-fit grid s minimální šířkou 280 px na plakát. Při viewport ~1280 px se vejdou 4, při ~800 px dva, ostatní wrappují dolů.
- **Mobile:** horizontální swipe, 1 plakát v hlavním zorném poli, ~10 % peek na sousední. Žádné šipky.
- Aspekt: A4 portrait je výchozí, ale `object-contain` zachová libovolný poměr.

## Migrace

### Schema migrace

`db/migrations/003_action_posters.sql`:

```sql
CREATE TABLE action_posters (
  id          SERIAL PRIMARY KEY,
  filename    TEXT NOT NULL,
  position    INTEGER NOT NULL,
  alt_text    TEXT NOT NULL DEFAULT 'Plakát akce',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_action_posters_position ON action_posters (position);
```

Pustí se při deployi (`npm run db:migrate`).

### Seed existujícího plakátu

One-shot skript `scripts/seed-action-posters.ts`. Idempotentní:

1. Pokud `${UPLOADS_DIR}/menu/action-1.webp` už existuje → nic.
2. Pokud `${UPLOADS_DIR}/menu/action.webp` existuje → přejmenovat na `action-1.webp` a:
   ```sql
   INSERT INTO action_posters (filename, position, alt_text)
   SELECT 'action-1.webp', 1, 'Plakát akce'
   WHERE NOT EXISTS (SELECT 1 FROM action_posters);
   ```
   (Tabulka nemá unique constraint na `filename`/`position`, takže `ON CONFLICT` nelze použít — `WHERE NOT EXISTS` zajistí idempotenci.)
3. `DELETE FROM menu_images WHERE type='action'` (úklid legacy řádku).

Spustí se ručně po deployi: `ssh root@VPS 'cd /opt/hospodaracice/app && npx tsx scripts/seed-action-posters.ts'`. Skript NENÍ součástí `scripts/deploy.sh`.

## Co se odstraňuje

- `'action'` z `IMAGE_TYPES` v `src/app/types.ts`.
- `action: 'Akce'` z `IMAGE_LABELS` v `src/app/admin/page.tsx`.
- Stávající upload slot „Akce" v admin UI → nahrazen `ActionPostersAdmin`.
- `resolveImage` v `src/app/page.tsx` pro action přestane být volán (smyčka jde po `IMAGE_TYPES` bez `action`). Tělo `resolveImage` zůstává beze změny — `.jpg` fallback je generický a stále slouží `permanent*`.
- `<section id="action">` blok v `src/app/components/MenuImages.tsx` → nahrazen `<ActionPosters>`.
- Větev `if (type === 'action')` neexistuje v `delete/route.ts` ani `upload/route.ts` (oba jdou generickou `else` cestou) — automaticky přestane fungovat po odstranění `action` z `IMAGE_TYPES`. Nicméně frontend tyto cesty pro action volat nebude, takže nevadí.

`visibleSections.action` typ zůstává, hodnota = `actionPosters.length > 0`.

## Edge cases

- **Smíšené aspect ratio** (portrait + landscape): `align-items: start` + `object-contain` + `max-h-[80vh]`. Rozdílná výška buněk je akceptovatelná.
- **Prázdný stav**: žádný řádek v `action_posters` → sekce se nerenderuje, navigační odkaz „Akce" se skryje.
- **Smazání uprostřed**: `DELETE` v transakci → `DELETE FROM action_posters WHERE id=$1` + `UPDATE action_posters SET position = ... ` (přečíslování dle row_number()).
- **Souběžný reorder** (admin v 2 tabech): last PATCH wins. Bez optimistic locking — pro single-admin nástroj OK.
- **Cache busting**: `<img src="...?${ts}">` jako jinde v repu.
- **WebP konverze**: stávající `processImage` v `src/app/admin/page.tsx` je inline funkce; v rámci implementace ji extrahuju do `src/app/admin/processImage.ts` a obě komponenty (`ActionPostersAdmin`, stávající admin) ji budou importovat. Server bere hotový WebP buffer.

## Out of scope

- Datum akce / automatické skrytí po datu — admin maže ručně.
- OCR extrakce textu plakátu (jako u weekly). Alt text je default; volitelně přepsat ručně.
- Email notifikace na nové akce, public preview před uploadem, batch upload víc souborů najednou.
- Reordering klávesnicí jako acceptance kritérium — dnd-kit ho podporuje out-of-the-box, nicméně se na něj v ověření necílí.

## Závislosti

Nové npm balíčky:

- `@dnd-kit/core`
- `@dnd-kit/sortable`
- `@dnd-kit/utilities`

Celkem ~15 KB gzipped v klient bundlu.

## Verifikace

Projekt nemá test framework. Ověření manuálně:

1. `npm run dev` → admin přihlášen → upload 1, 2, 3, 4, 6 plakátů → kontrola homepage při každém kroku.
2. Drag-and-drop reorder → ověřit, že public stránka po refreshi zobrazí nové pořadí.
3. Smazání prostředního plakátu → ověřit, že `position` v DB zůstává souvislé 1..N a public stránka je konzistentní.
4. Chrome devtools mobile emulator → ověřit swipe + peek na iPhone viewportu.
5. `npm run lint` čistý (bez nových warningů).
6. Po deployi a seed skriptu: smoke check `curl https://hospodaracice.cz/` → existující `action.webp` přejmenovaný a viditelný jako poster #1.
