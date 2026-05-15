# Autodetekce týdne při uploadu jídelníčku

**Datum:** 2026-05-15
**Status:** Schválený design

## Kontext a motivace

Admin občas nahraje obrázek týdenního jídelníčku do nesprávného týdne (vybere `weekly` tab v adminu, ale obrázek fakticky obsahuje datumy jiného týdne). Na webu se pak jídelníček zobrazuje v nesprávném tabu, nebo není vidět vůbec. Upload pipeline už dnes parsuje obrázek přes Claude Haiku Vision a extrahuje strukturovaný JSON `{days: [{day, date, meals}]}`, ve kterém datumy v ideálním případě jsou. Cílem je tuto informaci využít: pokud model z obrázku přečte datumy ukazující na jiný týden, než admin vybral, uložit jídelníček do detekovaného týdne a admina o tom informovat.

## Detekční logika

Nová utility funkce v `src/app/lib/week.ts`:

```ts
import type { WeeklyMenu } from '@/app/types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function detectWeekFromMenu(menu: WeeklyMenu): string | null {
  const mondayCounts = new Map<string, number>();
  for (const day of menu.days) {
    if (!day.date || !DATE_RE.test(day.date)) continue;
    const parsed = parseWeekKey(day.date);
    if (isNaN(parsed.getTime())) continue;
    const monday = formatWeekKey(getMonday(parsed));
    mondayCounts.set(monday, (mondayCounts.get(monday) ?? 0) + 1);
  }
  if (mondayCounts.size === 0) return null;
  return [...mondayCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
```

Z každého dne s neprázdným `date`, který projde regex sanitizací (`YYYY-MM-DD`) a není `Invalid Date`, se spočítá pondělí (`getMonday`), spočítají se výskyty pondělí napříč dny, vrátí se nejčastější (tiebreak: insertion order, tedy první vyzkoušený). `null` znamená „nelze rozhodnout" (žádné platné datumy v obrázku).

Existující `parseWeekKey` v `lib/week.ts` vrací `Date` bez validace vstupu (`new Date(NaN, NaN, NaN)` pro odpadky), proto explicitní regex + `isNaN` guardy. Halucinovaný / malformed `date` z Vision se tiše ignoruje.

Žádná sanity-check vůči okolí současného týdne — pokud Vision halucinuje, admin uvidí result v rerouted status message.

## Změna Vision promptu

V `src/app/api/upload/route.ts`, `extractMenu`. Aktuální instrukce:

> „Pokud datum není na obrázku, odhadni ho podle aktuálního týdne."

→ nahradit:

> „Pokud datum NENÍ na obrázku, nech pole `date` prázdný řetězec `\"\"`. Nikdy nevymýšlej datumy, které na obrázku nejsou."

Bez této změny by si model datumy vymýšlel a `detectWeekFromMenu` by „uspěla" s halucinovaným týdnem.

Dopad na rendering: `WeeklyMenuTabs` zobrazuje `day.date` jako text. Prázdný řetězec se vyrenderuje jako prázdno, bez chyby. Type `MenuDay.date: string` nepotřebuje změnu.

## Upload route — restrukturalizace

Aktuální pořadí ve weekly větvi `upload/route.ts`: `saveFile(adminWeek)` → `extractMenu` → UPSERT. To je špatně — soubor je zapsán pod admin-pickem dřív, než víme, jestli máme přesměrovat.

Nové pořadí:

1. `imageBuffer = Buffer.from(await file.arrayBuffer())` — jednou.
2. `const menu = await extractMenu(imageBuffer)`.
3. `const detectedWeek = menu ? detectWeekFromMenu(menu) : null`.
4. `const effectiveWeek = detectedWeek ?? adminWeek` (typ: `string`, validní pondělí).
5. `await saveFile('menu', \`weekly-${effectiveWeek}.webp\`, imageBuffer)`.
6. UPSERT `weekly_menu` keyed na `effectiveWeek`:
   - Pokud `menu`: `INSERT ... VALUES ($effectiveWeek, $data, $fullText, $altText) ON CONFLICT DO UPDATE`.
   - Jinak: `INSERT ... VALUES ($effectiveWeek, '{"days":[]}'::jsonb) ON CONFLICT DO NOTHING`.
7. Response viz níže.

Non-weekly větev (action posters, permanent obrázky) — beze změny.

## Response shape

Additive, neporuší existující konzumenty (admin používá jen `url` a `menuSaved`):

```ts
{
  url: string,
  menuSaved: boolean,
  adminWeek: string,
  detectedWeek: string | null,
  effectiveWeek: string,
  rerouted: boolean,  // detectedWeek != null && detectedWeek !== adminWeek
}
```

## Admin UI

V `src/app/admin/page.tsx`, `handleUpload(e, type)`. Po úspěšném POST načte response JSON. Jen pro `type === 'weekly'` rozhoduje mezi třemi případy:

| Případ | Podmínka | Status message | Side effect |
|---|---|---|---|
| **Match** | `detectedWeek === adminWeek` | „Jídelníček nahrán." | žádný |
| **Rerouted** | `rerouted === true` | „Jídelníček patří do týdne {effectiveRange} (vybral jsi {adminRange}), uloženo tam." | `setSelectedWeek(effectiveWeek)` — UI tab se přepne na cílový týden |
| **Unknown** | `detectedWeek === null` | „Týden se z obrázku nepodařilo rozpoznat, uloženo dle výběru ({adminRange}). Zkontroluj prosím ručně." | žádný |

`adminRange` a `effectiveRange` jsou `formatWeekRange(parseWeekKey(weekKey))` (existující helper, formát „06.06. - 12.06.").

Po showStatus se zavolá `loadUploadedWeeks()` (refresh seznamu — už dnes) a `resolveImages()` (refresh obrázku v aktuálním tabu — už dnes).

Non-weekly typy: status message zůstává „Soubor úspěšně nahrán!" beze změny.

## Edge cases

- **Některé dny prázdný `date`**: ignorují se, detekce běží na zbytek.
- **Žádné platné datumy**: `detectWeekFromMenu` vrátí `null` → Case Unknown, fallback na admin pick + warning.
- **`extractMenu` vrátí `null`** (Vision parse fail): menu se v DB skončí jako prázdné days, ale soubor pod adminWeek; status Unknown.
- **Rerouted overwriting existující menu pro `effectiveWeek`**: UPSERT správně přepíše (admin si je toho vědom skrz rerouted message).
- **Sanitizace `detectedWeek`**: `formatWeekKey(getMonday(...))` garantuje validní `YYYY-MM-DD` pondělí.

## Out of scope

- Sanity-check, že `detectedWeek` je v rozumném okolí `now` nebo `adminWeek`. Pokud Vision halucinuje letopočet, admin reaguje na rerouted status.
- Override checkbox v admin UI („uložit dle mého výběru, ne dle modelu") — YAGNI.
- Server-side log/telemetrie reroutů.
- Pokus o rozumné chování při smíchaném obrázku (různé dny patří různým týdnům). Majoritní vyhrává; smíchaný obrázek je v praxi nepravděpodobný.

## Závislosti

Žádné nové npm balíčky.

## Verifikace (manuálně)

1. `npm run dev` + lokální admin přihlášení.
2. Nahrát obrázek s datumy aktuálního týdne, vybrat aktuální týden → „Jídelníček nahrán."
3. Nahrát obrázek s datumy příštího týdne, vybrat aktuální → rerouted message + tab se přepne na příští týden.
4. Nahrát obrázek bez viditelných datumů → Unknown message, soubor uložen dle admin pick.
5. Veřejná homepage po refreshi: jídelníček je ve správném tabu, ve špatném tabu nic.
6. `npm run lint` čistý.

## Rizika

Claude Haiku Vision občas přečte datum nepřesně (např. zamění `7.` a `1.`). V takovém případě se jídelníček uloží do špatného týdne. Detekce není 100% spolehlivá, ale problém, který řešíme (admin uploadne do špatného týdne), má asymetrii: admin pick je jeden klik bez kontextu obrázku, model čte přímo z obrázku. Net-positive UX se předpokládá; v případě špatné detekce admin uvidí rerouted message a re-uploadne s opraveným obrázkem.
