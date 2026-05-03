# Týdenní jídelníček — taby pro tento a příští týden

**Datum:** 2026-05-03
**Status:** Schválený design

## Kontext a motivace

Týdenní jídelníček na další týden se na admin straně nahrává ve čtvrtek aktuálního týdne. Současný frontend ale ukazuje pouze obrázek a dny aktuálního týdne — uživatelé se k jídelníčku na další týden dostanou až v pondělí. Pro hosty, kteří plánují dopředu (a chtějí si objednat třeba pondělní oběd před nedělním deadlinem), tak vzniká informační mezera.

Cílem je v sekci `#weekly` zobrazit dva taby (`Tento týden`, `Příští týden`), pokud jsou pro oba týdny v DB jídelníčky, a pro každý tab nezávisle rozhodnout, jestli zobrazit objednávkový formulář (split layout) nebo jen vycentrovaný obrázek (po deadlinu).

## Zdroj pravdy

Tabulka `weekly_menu` je jediný zdroj pravdy o tom, jestli pro daný týden existuje jídelníček. Při uploadu se vždy vloží řádek (i když Vision selže — vloží se prázdný `data`). Soubor obrázku má deterministické jméno `weekly-{week_start}.webp` ve `UPLOADS_DIR/menu/`, takže URL skládáme přímo z `week_start` bez `fileExists` kontroly.

## Data flow

### Server (`src/app/page.tsx`)

1. Spočítá `currentWeekKey` (přes `getCurrentWeekKey`) a `nextWeekKey` (Monday + 7 dní, formátováno přes `formatWeekKey`).
2. Provede dotaz:
   ```sql
   SELECT week_start, data, full_text, alt_text
   FROM weekly_menu
   WHERE week_start IN ($1, $2)
   ```
3. Pro každý vrácený řádek poskládá `WeeklyTabData`.
4. `resolveImage` v `page.tsx` ztratí speciální větev pro `'weekly'` — IMAGE_TYPES mapping zpracuje pouze `action` a `permanent*` přes `fileExists`. Weekly obrázek/OCR se řeší samostatně nad `weekly_menu`.

### Nová prop pro `MenuImages`

```ts
interface WeeklyTabData {
  weekKey: string;        // "2026-05-04"
  weekRange: string;      // "04.05. - 10.05." (formatWeekRange)
  imageUrl: string;       // /uploads/menu/weekly-{key}.webp?{ts}
  ocrData?: ImageOcrData;
  days: MenuDay[];        // z data.days, prázdné pole pokud chybí
}

weeklyData: {
  current: WeeklyTabData | null;
  next: WeeklyTabData | null;
}
```

`availableImages` map už neobsahuje klíč `weekly` — zůstávají v ní jen `action` a `permanent*`. `visibleSections.weekly = !!(weeklyData.current || weeklyData.next)` (pro Navigation a alergenovou hlášku).

## Komponenty

### Nová: `src/app/components/WeeklyMenuTabs.tsx` (client)

Props:
```ts
{ current: WeeklyTabData | null; next: WeeklyTabData | null; }
```

Odpovědnosti:
- Drží `activeTab: 'current' | 'next'` přes `useState(() => initialTab(current, next))`.
- Renderuje tab bar pouze pokud `current && next`. Jinak rovnou renderuje view pro existující týden.
- Pod tab barem renderuje `<WeeklyWeekView data={activeData} />`.

Initial tab logika:
```ts
const hasOrderable = (w: WeeklyTabData | null) =>
  !!w && getOrderableDays(w.days).length > 0;

if (hasOrderable(current)) return 'current';
if (hasOrderable(next)) return 'next';
if (current) return 'current';
return 'next';
```

### Nová: `WeeklyWeekView` (vnořená v `WeeklyMenuTabs.tsx`)

Props: `{ data: WeeklyTabData }`

Logika:
- `orderableDays = getOrderableDays(data.days)` — pure výpočet, běží při každém renderu.
- Pokud `orderableDays.length > 0` → split layout (image vlevo `md:w-1/2 h-screen`, `<OrderForm days={orderableDays} />` vpravo `md:w-1/2`). Tailwind třídy stejné jako současný stav.
- Jinak → centered layout: `relative w-full h-screen flex items-center justify-center mt-4 mb-4` s `<img>` `max-h-full max-w-full object-contain shadow-lg`.
- `sr-only` div s `data.ocrData?.fullText` zachován v obou variantách.

### Nová utility: `src/app/lib/menuDeadline.ts`

```ts
export function getOrderableDays(days: MenuDay[]): MenuDay[] {
  return days.filter((d) => {
    const deadline = new Date(d.date + 'T10:00:00');
    deadline.setDate(deadline.getDate() - 1);
    return new Date() < deadline;
  });
}
```

Jediný zdroj pravdy o deadline pravidle (10:00 den předem). Použije ji `WeeklyMenuTabs` pro rozhodování o initial tabu a `WeeklyWeekView` pro filtrování dnů. `OrderForm` ji už nepotřebuje (dostane už vyfiltrované dny).

### Upravená: `src/app/components/OrderForm.tsx`

Změny:
- Nový povinný prop `days: MenuDay[]`.
- Odstraní `fetch('/api/menu')`, state `menu`, výpočet `availableDays`.
- Render dní iteruje přímo přes prop `days`.
- Zachová: state pro form fields, `fetch('/api/delivery-villages')`, GDPR souhlas, scroll-to-top po success, anchor `id="objednavka"`.
- Pokud `days.length === 0`, render vrátí `null` (defenzivní; rodič tento případ nevolá).

### Upravená: `src/app/components/MenuImages.tsx`

- Props: přibyde `weeklyData: { current: WeeklyTabData | null; next: WeeklyTabData | null }`. `availableImages` ztratí klíč `weekly`.
- Větev pro weekly se zjednoduší na:
  ```tsx
  {(weeklyData.current || weeklyData.next) && (
    <section id="weekly">
      <WeeklyMenuTabs current={weeklyData.current} next={weeklyData.next} />
    </section>
  )}
  ```
- Sekce `action`, `permanent`, alergenová hláška beze změny.

### `Navigation.tsx`

Beze změny. `visibleImages.weekly` se nadále počítá z `!!(weeklyData.current || weeklyData.next)` v `page.tsx`.

## Rendering & UX detaily

### Tab bar

Render pouze když oba týdny existují.

- Kontejner: `flex justify-center gap-2 pt-6 px-4 flex-wrap`
- Tlačítka: `rounded-full px-4 py-2 text-sm font-medium transition`
  - Aktivní: `bg-white text-gray-900`
  - Neaktivní: `bg-white/10 text-white border border-white/30 hover:bg-white/20`
- Label: `Tento týden · 04.05. - 10.05.` / `Příští týden · 11.05. - 17.05.` (jednořádkově)

### Split layout

Beze změny proti současnému stavu — `flex flex-col md:flex-row`, image `md:w-1/2 h-screen`, formulář `md:w-1/2 py-8`.

### Centered layout

`relative w-full h-screen flex items-center justify-center mt-4 mb-4` s `<img>` `max-h-full max-w-full object-contain shadow-lg`. Vizuálně shodné s aktuální `action` sekcí.

### Anchory

- `id="weekly"` zůstává na rootu sekce (před tab barem).
- `id="objednavka"` zůstává v `OrderForm` — funguje jen v split layoutu (logické: skok na objednávku má smysl jen když je formulář vidět).

### Mobile

Tab bar nahoře, full width, `flex-wrap` jako safety. Pod ním `flex-col` (image nad formulářem) v split layoutu, vycentrovaný image v centered layoutu.

## Edge cases

| Scénář | Chování |
|---|---|
| Oba týdny chybí v DB | `WeeklyMenuTabs` se nerenderuje; weekly sekce skrytá (jako dnes) |
| Pouze jeden týden má řádek | Bez tab baru, render `WeeklyWeekView` pro dostupný týden |
| Řádek existuje, `data.days` prázdné/chybí | `getOrderableDays([])` vrátí `[]` → centered layout |
| Stránka otevřená přes půlnoc deadlinu | `getOrderableDays` se přepočítá při každém renderu, ale `activeTab` se nemění auto. Přepnutí tabu nebo jakákoliv re-render akce zaktualizuje view. Žádný interval timer. |
| Cache-busting | `?{Date.now()}` v `imageUrl` se generuje server-side (page má `dynamic = 'force-dynamic'`) |

## Co se nemění

- `/api/menu` route — endpoint zůstává, `OrderForm` ho už nevolá. Pokud ho nikdo jiný nevolá, je to kandidát na smazání mimo scope této featury.
- Server-side deadline validace v `/api/orders` — mimo scope.
- Admin panel, upload route, OCR pipeline, GDPR, scroll-to-top, layout `action`/`permanent` sekcí.
- Polling/auto-refresh při překročení deadlinu — vědomě neimplementuje.

## Out of scope

- Indikace stavu „načítáme jídelníček" (žádné loading state — vše server-side).
- Server-side validace deadlinu na endpointu objednávek (oddělený potenciální bug).
- Rozšíření tabů o více než 2 týdny.
- Auto-přepnutí na další tab po překročení deadlinu posledního dne aktuálního tabu.

## Acceptance kritéria

1. Pokud `weekly_menu` obsahuje řádky pro `currentWeekKey` i `nextWeekKey`, na homepage v sekci `#weekly` se nad obsahem zobrazí 2 taby s popisky `Tento týden · DD.MM. - DD.MM.` a `Příští týden · DD.MM. - DD.MM.`.
2. Default aktivní tab je „Tento týden", pokud má alespoň jeden objednatelný den; jinak „Příští týden", pokud ten má objednatelný den; jinak „Tento týden" (centered fallback).
3. V tabu, který má alespoň jeden objednatelný den (deadline 10:00 den předem), se zobrazí split layout (obrázek + formulář s pouze dny daného týdne).
4. V tabu, který nemá žádný objednatelný den, se zobrazí jen vycentrovaný obrázek bez formuláře.
5. Pokud existuje pouze jeden týden, tab bar se nerenderuje; chování stejné jako bod 3/4 pro daný týden.
6. Pokud neexistuje žádný týden, sekce `#weekly` se nerenderuje.
7. `OrderForm` po refaktoru nedělá `fetch('/api/menu')` — dny dostává jako prop.
8. Anchor `#weekly` v Navigation skočí na záhlaví sekce (s tab barem, pokud je vidět). Anchor `#objednavka` funguje, pokud je formulář aktuálně viditelný.
