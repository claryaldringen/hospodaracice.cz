# Auto-Detect Menu Week — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When admin uploads a weekly menu image, use the dates that Claude Vision already extracts from the image to detect which week the menu actually belongs to, and route the upload to that week (rather than the week the admin picked in the dropdown).

**Architecture:** Add a pure utility `detectWeekFromMenu()` that picks the majority Monday from the extracted per-day dates. Reorder the weekly upload flow so extraction happens before file save, allowing the file/DB to be keyed on the detected week. Tighten the Vision prompt so the model doesn't fabricate dates. Admin UI reads the new response shape and shows one of three status messages (matched / rerouted / unknown); on rerouted, it switches the active tab to the detected week.

**Tech Stack:** Next.js 15 App Router, TypeScript, `pg`, Claude Haiku Vision via `@anthropic-ai/sdk`. No new dependencies.

**Project context:** No test framework in repo. Each task ends with manual verification + commit. Implement on a feature branch.

**Spec:** `docs/superpowers/specs/2026-05-15-auto-detect-menu-week-design.md`

---

## File Structure

**Modify:**
- `src/app/lib/week.ts` — add `detectWeekFromMenu(menu)` helper
- `src/app/api/upload/route.ts` — change Vision prompt; restructure weekly branch (extract → detect → save → upsert); return new response shape
- `src/app/admin/page.tsx` — handle new response: 3 status messages for `type === 'weekly'`, `setSelectedWeek(effectiveWeek)` on reroute

**Create:** none

---

## Task 0: Setup feature branch

**Files:** none (git only)

- [ ] **Step 1: Branch from main**

```bash
git checkout main && git pull
git checkout -b feat/auto-detect-menu-week
```

- [ ] **Step 2: Verify clean tree**

```bash
git status
```

Expected: `nothing to commit, working tree clean`.

---

## Task 1: `detectWeekFromMenu` helper

**Files:**
- Modify: `src/app/lib/week.ts`

Pure function that picks the majority Monday from extracted per-day dates. Defensive against empty / malformed `date` strings (Vision may hallucinate or omit).

- [ ] **Step 1: Append helper at end of `src/app/lib/week.ts`**

Add to the file (after `getCurrentWeekKey`):

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

Note: the import for `WeeklyMenu` goes at the top of the file. Add it next to (or near) any other imports if present, or at the very top if the file has no imports yet.

- [ ] **Step 2: Verify TS compiles**

```bash
npx tsc --noEmit
```

Expected: clean (no output).

- [ ] **Step 3: Quick mental dry-run with sample inputs**

Inspect the function visually:
- Empty `menu.days` → `mondayCounts.size === 0` → returns `null`.
- All days have empty `date` → all skipped → `null`.
- All days have valid dates from same week → all map to same Monday → returns that Monday.
- Mixed dates across two weeks (e.g., 3 vs 2) → majority Monday wins.
- Date "blabla" → regex fails → skipped.
- Date "2026-13-99" → regex passes, `parseWeekKey` returns Invalid Date → `isNaN` skips.

No actual unit test (no framework). Trust the structure.

- [ ] **Step 4: Commit**

```bash
git add src/app/lib/week.ts
git commit -m "feat(lib): detectWeekFromMenu picks majority Monday from menu days"
```

---

## Task 2: Upload route — tighten prompt + restructure weekly branch

**Files:**
- Modify: `src/app/api/upload/route.ts`

Three coordinated changes that must land together (the new response shape is meaningless without the new flow, and the new flow is unsafe without the prompt change):

1. Tighten the Vision prompt so it doesn't fabricate dates when absent.
2. Reorder the weekly branch so `extractMenu` runs before `saveFile`; the file and DB row are keyed on the detected week (with fallback to admin's pick).
3. Return the new response shape with `adminWeek`, `detectedWeek`, `effectiveWeek`, `rerouted`.

- [ ] **Step 1: Tighten the prompt in `extractMenu`**

Find the text in `src/app/api/upload/route.ts`:

```
Pokud datum není na obrázku, odhadni ho podle aktuálního týdne. Cenu uveď jako číslo bez Kč.
```

Replace with:

```
Pokud datum NENÍ na obrázku, nech pole "date" prázdný řetězec "". Nikdy nevymýšlej datumy, které na obrázku nejsou. Cenu uveď jako číslo bez Kč.
```

- [ ] **Step 2: Restructure the weekly branch**

The current weekly flow (POST handler, weekly branch) is roughly:

```ts
const filename = type === 'weekly' ? `weekly-${week}.webp` : `${type}.webp`;
const imageBuffer = Buffer.from(await file.arrayBuffer());
await saveFile('menu', filename, imageBuffer);

const url = getPublicUrl('menu', filename);
let menuSaved = false;

if (type === 'weekly' && week) {
  const menu = await extractMenu(imageBuffer);
  if (menu) {
    const fullText = menuToText(menu);
    const altText = createAltText(fullText);
    await query(
      `INSERT INTO weekly_menu (week_start, data, full_text, alt_text)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (week_start) DO UPDATE SET data = $2, full_text = $3, alt_text = $4`,
      [week, JSON.stringify(menu), fullText, altText]
    );
    menuSaved = true;
  } else {
    await query(
      `INSERT INTO weekly_menu (week_start, data)
       VALUES ($1, '{"days":[]}'::jsonb)
       ON CONFLICT (week_start) DO NOTHING`,
      [week]
    );
  }
}

return NextResponse.json({ url, menuSaved });
```

Replace it with the following structure. Non-weekly branch stays as-is — separate the two paths cleanly:

```ts
const imageBuffer = Buffer.from(await file.arrayBuffer());

if (type === 'weekly') {
  // week is validated above (isValidWeekKey), so this is safe
  const adminWeek = week!;
  const menu = await extractMenu(imageBuffer);
  const detectedWeek = menu ? detectWeekFromMenu(menu) : null;
  const effectiveWeek = detectedWeek ?? adminWeek;

  const filename = `weekly-${effectiveWeek}.webp`;
  await saveFile('menu', filename, imageBuffer);
  const url = getPublicUrl('menu', filename);

  let menuSaved = false;
  if (menu) {
    const fullText = menuToText(menu);
    const altText = createAltText(fullText);
    await query(
      `INSERT INTO weekly_menu (week_start, data, full_text, alt_text)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (week_start) DO UPDATE SET data = $2, full_text = $3, alt_text = $4`,
      [effectiveWeek, JSON.stringify(menu), fullText, altText]
    );
    menuSaved = true;
  } else {
    await query(
      `INSERT INTO weekly_menu (week_start, data)
       VALUES ($1, '{"days":[]}'::jsonb)
       ON CONFLICT (week_start) DO NOTHING`,
      [effectiveWeek]
    );
  }

  return NextResponse.json({
    url,
    menuSaved,
    adminWeek,
    detectedWeek,
    effectiveWeek,
    rerouted: detectedWeek !== null && detectedWeek !== adminWeek,
  });
}

// Non-weekly: unchanged behavior
const filename = `${type}.webp`;
await saveFile('menu', filename, imageBuffer);
const url = getPublicUrl('menu', filename);
return NextResponse.json({ url, menuSaved: false });
```

- [ ] **Step 3: Add the import for `detectWeekFromMenu`**

At the top of `src/app/api/upload/route.ts`, find the existing import:

```ts
import { isValidWeekKey } from '@/app/lib/week';
```

Replace with:

```ts
import { isValidWeekKey } from '@/app/lib/week';
import { detectWeekFromMenu } from '@/app/lib/week';
```

Or merge into one line — match the codebase style. Both forms are fine for TS.

- [ ] **Step 4: Verify TS compiles**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 5: Verify lint clean**

```bash
npm run lint 2>&1 | grep -i error
```

Expected: no output (no errors; pre-existing `<img>` warnings in admin/page.tsx and Gallery.tsx are fine).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/upload/route.ts
git commit -m "feat(api): detect menu week from Vision OCR, reroute upload"
```

---

## Task 3: Admin UI — handle new response

**Files:**
- Modify: `src/app/admin/page.tsx`

Existing `handleUpload(e, type)` already does `const data = await res.json()` after a successful POST and uses `data.url`. Extend it to handle the new weekly-only response fields.

- [ ] **Step 1: Import `formatWeekRange` and `parseWeekKey` in admin page**

Find the import line at the top of `src/app/admin/page.tsx`:

```ts
import { getWeekOptions, getCurrentWeekKey } from '@/app/lib/week';
```

Replace with:

```ts
import {
  getWeekOptions,
  getCurrentWeekKey,
  formatWeekRange,
  parseWeekKey,
} from '@/app/lib/week';
```

- [ ] **Step 2: Update `handleUpload` to branch on the response**

Locate the `handleUpload` function (currently calls `fetch('/api/upload', { method: 'POST', body: formData })`). Around the `if (res.ok)` branch:

Current code (rough shape):

```ts
if (res.ok) {
  const data = await res.json();
  URL.revokeObjectURL(previewUrl);
  setImages((prev) => ({ ...prev, [type]: `${data.url}?${new Date().getTime()}` }));
  showStatus('success', 'Soubor úspěšně nahrán!');
  if (type === 'weekly') loadUploadedWeeks();
} else {
  URL.revokeObjectURL(previewUrl);
  showStatus('error', 'Chyba při nahrávání souboru.');
}
```

Replace the `if (res.ok)` body with:

```ts
if (res.ok) {
  const data = await res.json();
  URL.revokeObjectURL(previewUrl);

  if (type === 'weekly') {
    const adminRange = formatWeekRange(parseWeekKey(data.adminWeek));
    const effectiveRange = formatWeekRange(parseWeekKey(data.effectiveWeek));

    if (data.rerouted) {
      showStatus(
        'success',
        `Jídelníček patří do týdne ${effectiveRange} (vybral jsi ${adminRange}), uloženo tam.`
      );
      setSelectedWeek(data.effectiveWeek);
    } else if (data.detectedWeek === null) {
      showStatus(
        'success',
        `Týden se z obrázku nepodařilo rozpoznat, uloženo dle výběru (${adminRange}). Zkontroluj prosím ručně.`
      );
      setImages((prev) => ({ ...prev, [type]: `${data.url}?${new Date().getTime()}` }));
    } else {
      showStatus('success', 'Jídelníček nahrán.');
      setImages((prev) => ({ ...prev, [type]: `${data.url}?${new Date().getTime()}` }));
    }
    loadUploadedWeeks();
  } else {
    setImages((prev) => ({ ...prev, [type]: `${data.url}?${new Date().getTime()}` }));
    showStatus('success', 'Soubor úspěšně nahrán!');
  }
} else {
  URL.revokeObjectURL(previewUrl);
  showStatus('error', 'Chyba při nahrávání souboru.');
}
```

Key behavioral notes:
- **Rerouted**: `setSelectedWeek(data.effectiveWeek)` switches the admin tab to the new week. The `useEffect` that calls `resolveImages` will pick up the new selectedWeek and refresh the image — no need to manually `setImages` here.
- **Unknown** and **Match**: `setImages` updates the preview URL with cache-bust (same as old code).
- Non-weekly types: unchanged behavior, same message as before.

- [ ] **Step 3: Verify TS compiles**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Verify lint clean**

```bash
npm run lint 2>&1 | grep -i error
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat(admin): handle reroute/unknown response from weekly upload"
```

---

## Task 4: Manual end-to-end smoke + open PR + merge + deploy

**Files:** none (manual + git ops)

- [ ] **Step 1: Bring up local dev stack**

If docker postgres + .env from previous session aren't around, recreate:

```bash
docker run -d --name hospodaracice-pg \
  -e POSTGRES_USER=hospoda -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=hospodaracice \
  -p 5532:5432 postgres:16-alpine

until docker exec hospodaracice-pg pg_isready -U hospoda > /dev/null 2>&1; do sleep 1; done

mkdir -p uploads/menu uploads/gallery
ln -sfn ../uploads public/uploads

cat > .env <<EOF
DATABASE_URL=postgres://hospoda:dev@localhost:5532/hospodaracice
UPLOADS_DIR=./uploads
NEXT_PUBLIC_UPLOADS_URL=/uploads
ADMIN_SECRET=dev
NEXT_PUBLIC_BASE_URL=http://localhost:3008
TOTAL_SEATS=40
EOF
```

`extractMenu` calls Claude Vision and needs a real `ANTHROPIC_API_KEY`. If you have one (e.g., from prod `.env` on the VPS, or your own dev key), append it to the `.env` above before `npm run dev`. If not, **skip the manual end-to-end test (Step 3)** and rely on prod smoke after deploy. The static checks (tsc + lint) verify the code path independently of Vision.

```bash
npm run db:migrate
npm run dev
```

- [ ] **Step 2: Verify dev server is up**

```bash
curl -sf -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3008/
```

Expected: HTTP 200.

- [ ] **Step 3: Manual end-to-end (if ANTHROPIC_API_KEY available)**

1. Open http://localhost:3008/admin, log in with `dev`.
2. Take an image of a weekly menu that has dates corresponding to the **current** week. Upload it with the current week selected → status: "Jídelníček nahrán."
3. Take an image of a weekly menu with dates for the **next** week. Select the current week → upload → status: "Jídelníček patří do týdne {next-range} (vybral jsi {current-range}), uloženo tam." + admin tab switches to next week.
4. Take an image with no visible dates (or just an unrelated image) → upload → status: "Týden se z obrázku nepodařilo rozpoznat, uloženo dle výběru ({current-range}). Zkontroluj prosím ručně."
5. Refresh http://localhost:3008/ — verify the menu appears under the correct tab in each case.

If anything misbehaves, debug locally before pushing. Don't skip this step if you have the API key — Vision behavior on real images is the riskiest part.

- [ ] **Step 4: Tear down local dev**

```bash
pkill -f "next dev" 2>/dev/null
docker rm -f hospodaracice-pg
rm -rf uploads .env public/uploads
```

- [ ] **Step 5: Push branch + open PR**

```bash
git push -u origin feat/auto-detect-menu-week
gh pr create --title "feat: auto-detect menu week from Vision OCR" --body "$(cat <<'EOF'
## Summary

When admin uploads a weekly menu image, use the dates Vision already extracts from the image to detect the correct week and route the upload there. Three UX outcomes in admin:

- **Matched** (detected week = admin's pick): "Jídelníček nahrán."
- **Rerouted** (detected week differs): notify admin which week it landed in, switch the tab.
- **Unknown** (no readable dates): fall back to admin's pick, warn admin to check manually.

Tightens the Vision prompt so the model no longer fabricates dates when absent — without that, "detected" would silently mean "hallucinated current week".

Spec: `docs/superpowers/specs/2026-05-15-auto-detect-menu-week-design.md`
Plan: `docs/superpowers/plans/2026-05-15-auto-detect-menu-week.md`

## Test plan

- [x] `npm run lint` / `npx tsc --noEmit` clean
- [ ] Local manual: matched / rerouted / unknown — verify status messages and tab switch
- [ ] After deploy: smoke check `curl https://hospodaracice.cz/` still serves homepage

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: Merge after review**

```bash
gh pr merge --merge --delete-branch
```

`gh pr merge` will fast-forward local `main`.

- [ ] **Step 7: Deploy to VPS**

```bash
ssh root@204.168.176.128 'cd /opt/hospodaracice/app && bash scripts/deploy.sh' 2>&1 | tail -20
```

Verify final line is `=== Deploy complete ===` and PM2 shows `hospodaracice` restarted (uptime ~0s).

- [ ] **Step 8: Production smoke**

```bash
curl -sf -o /dev/null -w "HTTP %{http_code}\n" https://hospodaracice.cz/
```

Expected: HTTP 200. The new behavior is admin-only and won't show on the public homepage unless an admin uploads something fresh.

No data migration needed: existing `weekly_menu` rows are untouched; the new code only changes how *new* uploads are routed.
