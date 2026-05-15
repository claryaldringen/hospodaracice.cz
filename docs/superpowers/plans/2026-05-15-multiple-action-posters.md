# Multiple Action Posters — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-slot `action.webp` with a flexible list of posters, manually ordered in admin via drag-and-drop, displayed in an auto-fit grid on desktop and horizontal swipe on mobile.

**Architecture:** New `action_posters` table (id, filename, position, alt_text). Filenames are `action-{id}.webp` — stable across reorders. Public render via server component reading the table; admin via client component using `@dnd-kit/sortable`. Migration of existing `action.webp` via idempotent seed script.

**Tech Stack:** Next.js 15 App Router, React 19, PostgreSQL (`pg`), Tailwind v4, `@dnd-kit/{core,sortable,utilities}` (new dependency).

**Project context:** No test framework in repo (per spec). Each task ends with manual verification + commit. Implement on a feature branch; final task opens PR.

**Spec:** `docs/superpowers/specs/2026-05-15-multiple-action-posters-design.md`

**Deviations from spec (deliberate, YAGNI):**
- Spec lists `PATCH /api/action-posters/[id]` for editing `alt_text` and a `<details>` block in admin to expose it. Both are tagged as "volitelné" in the spec. v1 ships with the default `'Plakát akce'` only; admin shows alt_text readonly. Trivial to add later if anyone asks for it.

---

## File Structure

**Create:**
- `db/migrations/003_action_posters.sql` — schema migration
- `scripts/seed-action-posters.ts` — idempotent one-shot data migration
- `src/app/api/action-posters/route.ts` — `GET` (public list), `POST` (admin upload)
- `src/app/api/action-posters/[id]/route.ts` — `DELETE` (admin), `PATCH` alt_text (admin)
- `src/app/api/action-posters/order/route.ts` — `PATCH` reorder (admin)
- `src/app/admin/processImage.ts` — extracted client helper
- `src/app/components/ActionPosters.tsx` — public section
- `src/app/admin/ActionPostersAdmin.tsx` — admin DnD component

**Modify:**
- `package.json` — add `@dnd-kit/*` deps
- `src/app/types.ts` — add `ActionPoster`, remove `'action'` from `IMAGE_TYPES`
- `src/app/page.tsx` — fetch `action_posters`, render `ActionPosters`
- `src/app/components/MenuImages.tsx` — replace `<section id="action">` with `ActionPosters` prop
- `src/app/admin/page.tsx` — extract `processImage`, replace single action slot with `ActionPostersAdmin`

---

## Task 0: Setup feature branch

**Files:** none (git only)

- [ ] **Step 1: Branch from main**

```bash
git checkout main && git pull
git checkout -b feat/action-posters
```

- [ ] **Step 2: Verify clean tree**

```bash
git status
```

Expected: `nothing to commit, working tree clean`.

---

## Task 1: Add `@dnd-kit` dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install deps**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Verify package.json has all three under `dependencies`**

```bash
grep -E '@dnd-kit/(core|sortable|utilities)' package.json
```

Expected: three lines, one per package.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @dnd-kit deps for action posters reorder"
```

---

## Task 2: DB migration — `action_posters` table

**Files:**
- Create: `db/migrations/003_action_posters.sql`

- [ ] **Step 1: Write migration**

```sql
-- db/migrations/003_action_posters.sql
CREATE TABLE action_posters (
  id          SERIAL PRIMARY KEY,
  filename    TEXT NOT NULL,
  position    INTEGER NOT NULL,
  alt_text    TEXT NOT NULL DEFAULT 'Plakát akce',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_action_posters_position ON action_posters (position);
```

- [ ] **Step 2: Apply locally**

```bash
npm run db:migrate
```

Expected output ends with `Applied 003_action_posters.sql` and `Migrations complete.`.

- [ ] **Step 3: Verify table exists**

```bash
psql "$DATABASE_URL" -c "\\d action_posters"
```

Expected: columns `id`, `filename`, `position`, `alt_text`, `created_at`. If `psql` not available locally, skip; production verification happens during deploy.

- [ ] **Step 4: Commit**

```bash
git add db/migrations/003_action_posters.sql
git commit -m "feat(db): add action_posters table"
```

---

## Task 3: Add `ActionPoster` type

**Files:**
- Modify: `src/app/types.ts`

Add the type (do NOT yet remove `'action'` from `IMAGE_TYPES` — that comes in Task 9 after the new public component is wired).

- [ ] **Step 1: Append type**

Add at the end of `src/app/types.ts`:

```ts
export interface ActionPoster {
  id: number;
  filename: string;
  position: number;
  altText: string;
}
```

- [ ] **Step 2: Verify TS compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/types.ts
git commit -m "feat(types): add ActionPoster"
```

---

## Task 4: API — `GET /api/action-posters`

**Files:**
- Create: `src/app/api/action-posters/route.ts`

- [ ] **Step 1: Write GET handler**

```ts
// src/app/api/action-posters/route.ts
import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import type { ActionPoster } from '@/app/types';

export async function GET() {
  const rows = await query<{
    id: number;
    filename: string;
    position: number;
    alt_text: string;
  }>('SELECT id, filename, position, alt_text FROM action_posters ORDER BY position ASC');

  const posters: ActionPoster[] = rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    position: r.position,
    altText: r.alt_text,
  }));

  return NextResponse.json({ posters });
}
```

- [ ] **Step 2: Run dev and hit endpoint**

```bash
npm run dev
# in another shell:
curl -s http://localhost:3008/api/action-posters
```

Expected: `{"posters":[]}` (table empty).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/action-posters/route.ts
git commit -m "feat(api): GET /api/action-posters"
```

---

## Task 5: API — `POST /api/action-posters` (upload)

**Files:**
- Modify: `src/app/api/action-posters/route.ts`

Strategy: INSERT with placeholder filename to claim an `id`, then UPDATE filename to `action-{id}.webp` and save the file. Atomic against duplicate IDs.

- [ ] **Step 1: Add POST handler**

Append to `src/app/api/action-posters/route.ts`:

```ts
import { isAuthenticated } from '@/app/lib/auth';
import { saveFile } from '@/app/lib/storage';
import { queryOne } from '@/app/lib/db';

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ message: 'No file' }, { status: 400 });
  }

  const next = await queryOne<{ next_position: number }>(
    'SELECT COALESCE(MAX(position), 0) + 1 AS next_position FROM action_posters'
  );
  const position = next?.next_position ?? 1;

  const inserted = await queryOne<{ id: number }>(
    `INSERT INTO action_posters (filename, position) VALUES ('', $1) RETURNING id`,
    [position]
  );
  if (!inserted) {
    return NextResponse.json({ message: 'Insert failed' }, { status: 500 });
  }

  const filename = `action-${inserted.id}.webp`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await saveFile('menu', filename, buffer);

  await queryOne(
    'UPDATE action_posters SET filename = $1 WHERE id = $2 RETURNING id',
    [filename, inserted.id]
  );

  return NextResponse.json({
    id: inserted.id,
    filename,
    position,
    altText: 'Plakát akce',
  });
}
```

- [ ] **Step 2: Run dev, upload a test image with curl**

```bash
# create a tiny webp via cli or grab any small image
curl -X POST http://localhost:3008/api/action-posters \
  -H "Cookie: $(grep -o 'session=[^;]*' ~/.cache/hospoda-dev-cookie 2>/dev/null || echo session=test)" \
  -F "file=@/tmp/test.webp"
```

Expected: 401 (since no real auth) — verifies auth gate. To test happy path: log into admin in browser first, then re-run with browser-extracted cookie. Or: temporarily comment out the `isAuthenticated` check, verify upload, then restore.

Quick happy-path: log into admin at http://localhost:3008/admin and run `curl` from devtools (it auto-includes the session cookie if executed via devtools). Expected JSON: `{"id":1,"filename":"action-1.webp","position":1,"altText":"Plakát akce"}`.

- [ ] **Step 3: Verify file on disk + DB row**

```bash
ls uploads/menu/action-1.webp
# psql or via GET
curl -s http://localhost:3008/api/action-posters
```

Expected: file exists, GET returns one poster.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/action-posters/route.ts
git commit -m "feat(api): POST /api/action-posters"
```

---

## Task 6: API — `DELETE /api/action-posters/[id]`

**Files:**
- Create: `src/app/api/action-posters/[id]/route.ts`

After delete, renumber `position` so it stays 1..N.

- [ ] **Step 1: Write DELETE handler**

```ts
// src/app/api/action-posters/[id]/route.ts
import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/app/lib/auth';
import { deleteFile } from '@/app/lib/storage';
import { query, queryOne } from '@/app/lib/db';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ message: 'Invalid id' }, { status: 400 });
  }

  const row = await queryOne<{ filename: string }>(
    'SELECT filename FROM action_posters WHERE id = $1',
    [id]
  );
  if (!row) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  await query('DELETE FROM action_posters WHERE id = $1', [id]);
  await query(
    `UPDATE action_posters
     SET position = sub.new_pos
     FROM (
       SELECT id, ROW_NUMBER() OVER (ORDER BY position ASC) AS new_pos
       FROM action_posters
     ) sub
     WHERE action_posters.id = sub.id AND action_posters.position <> sub.new_pos`
  );

  await deleteFile('menu', row.filename);

  return NextResponse.json({ message: 'Deleted' });
}
```

- [ ] **Step 2: Test against admin session**

Upload 3 posters via the UI (after Task 11) or via POST in devtools. Delete the middle one.

```bash
curl -X DELETE http://localhost:3008/api/action-posters/2
curl -s http://localhost:3008/api/action-posters
```

Expected: GET returns 2 posters with positions `1, 2` (no gap).

For now (no admin UI yet), only verify the handler compiles + returns 401 without auth:

```bash
curl -X DELETE http://localhost:3008/api/action-posters/999
```

Expected: 401.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/action-posters/\[id\]/route.ts
git commit -m "feat(api): DELETE /api/action-posters/[id] with position renumber"
```

---

## Task 7: API — `PATCH /api/action-posters/order` (reorder)

**Files:**
- Create: `src/app/api/action-posters/order/route.ts`

Atomic reorder in a transaction. Validates body contains exactly the existing IDs (no missing, no extra).

- [ ] **Step 1: Write PATCH handler**

```ts
// src/app/api/action-posters/order/route.ts
import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { isAuthenticated } from '@/app/lib/auth';

let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}

export async function PATCH(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = body?.ids;
  if (!Array.isArray(ids) || !ids.every((x) => Number.isInteger(x) && (x as number) > 0)) {
    return NextResponse.json({ message: 'Body must be { ids: number[] }' }, { status: 400 });
  }
  const idSet = new Set<number>(ids as number[]);
  if (idSet.size !== ids.length) {
    return NextResponse.json({ message: 'Duplicate ids' }, { status: 400 });
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query<{ id: number }>(
      'SELECT id FROM action_posters FOR UPDATE'
    );
    const existingIds = new Set(existing.rows.map((r) => r.id));
    if (
      existingIds.size !== idSet.size ||
      [...idSet].some((id) => !existingIds.has(id))
    ) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { message: 'ids must match exactly the existing posters' },
        { status: 400 }
      );
    }

    for (let i = 0; i < ids.length; i++) {
      await client.query('UPDATE action_posters SET position = $1 WHERE id = $2', [
        i + 1,
        ids[i],
      ]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return NextResponse.json({ message: 'Reordered' });
}
```

- [ ] **Step 2: Verify 401 path**

```bash
curl -X PATCH http://localhost:3008/api/action-posters/order \
  -H "Content-Type: application/json" -d '{"ids":[1,2]}'
```

Expected: 401.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/action-posters/order/route.ts
git commit -m "feat(api): PATCH /api/action-posters/order"
```

---

## Task 8: Extract `processImage` helper

**Files:**
- Create: `src/app/admin/processImage.ts`
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Create helper module**

```ts
// src/app/admin/processImage.ts
const MAX_WIDTH = 1920;
const WEBP_QUALITY = 0.85;

export function processImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_WIDTH) {
        height = Math.round(height * (MAX_WIDTH / width));
        width = MAX_WIDTH;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed'));
        },
        'image/webp',
        WEBP_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}
```

Values copied verbatim from the existing inline definition in `src/app/admin/page.tsx` (lines 14–15).

- [ ] **Step 2: Replace inline function in `admin/page.tsx`**

In `src/app/admin/page.tsx`:
- Remove the `MAX_WIDTH`, `WEBP_QUALITY` consts and the inline `processImage` function (currently near the top).
- Add import at the top: `import { processImage } from '@/app/admin/processImage';`

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: no new errors.

- [ ] **Step 4: Smoke test in browser**

`npm run dev`, log in to admin, upload any existing image type (e.g., `permanent1`) — verify it still works.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/processImage.ts src/app/admin/page.tsx
git commit -m "refactor(admin): extract processImage into shared module"
```

---

## Task 9: Public component `ActionPosters` + homepage wiring

**Files:**
- Create: `src/app/components/ActionPosters.tsx`
- Modify: `src/app/page.tsx`, `src/app/components/MenuImages.tsx`, `src/app/types.ts`

This task is the public-side switchover. After it, the old `action.webp` rendering path is gone; the new section reads from `action_posters`. DB is still empty in dev, so the section won't render until seed (Task 12) or admin upload (Task 11).

- [ ] **Step 1: Create the public component**

```tsx
// src/app/components/ActionPosters.tsx
import { getPublicUrl } from '@/app/lib/storage';
import type { ActionPoster } from '@/app/types';

interface Props {
  posters: ActionPoster[];
}

export default function ActionPosters({ posters }: Props) {
  if (posters.length === 0) return null;
  const ts = Date.now();

  return (
    <section id="action" className="py-4">
      <div className="hidden md:grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 px-4 items-start">
        {posters.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.id}
            src={`${getPublicUrl('menu', p.filename)}?${ts}`}
            alt={p.altText}
            className="w-full max-h-[80vh] object-contain"
            loading="eager"
          />
        ))}
      </div>
      <div className="md:hidden flex overflow-x-auto snap-x snap-mandatory gap-3 px-4 pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {posters.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.id}
            src={`${getPublicUrl('menu', p.filename)}?${ts}`}
            alt={p.altText}
            className="min-w-[80vw] snap-center max-h-[80vh] object-contain"
            loading="eager"
          />
        ))}
      </div>
      <div className="sr-only">
        {posters.map((p) => (
          <span key={p.id}>{p.altText}. </span>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Update `src/app/types.ts` — remove `'action'` from `IMAGE_TYPES`**

Change:

```ts
export const IMAGE_TYPES = [
  'action',
  'weekly',
  'permanent1',
  'permanent2',
  'permanent3',
  'permanent4',
] as const;
```

to:

```ts
export const IMAGE_TYPES = [
  'weekly',
  'permanent1',
  'permanent2',
  'permanent3',
  'permanent4',
] as const;
```

- [ ] **Step 3: Update `MenuImages.tsx` — accept posters prop, replace action section**

In `src/app/components/MenuImages.tsx`:

1. Import `ActionPosters`: `import ActionPosters from '@/app/components/ActionPosters';`
2. Import `ActionPoster` type: add `ActionPoster` to the existing import from `@/app/types`.
3. Add `actionPosters: ActionPoster[];` to `MenuImagesProps`.
4. Destructure `actionPosters` in the component signature.
5. Replace the entire `{visibleSections.action && availableImages.action && ( ... )}` block (currently lines 26–39) with:

```tsx
{visibleSections.action && <ActionPosters posters={actionPosters} />}
```

- [ ] **Step 4: Update `src/app/page.tsx` — fetch posters, pass to MenuImages**

In `src/app/page.tsx`:

1. Import the type: add `ActionPoster` to the existing import from `@/app/types`.
2. Add a new fetch function after `fetchOcrData`:

```ts
async function fetchActionPosters(): Promise<ActionPoster[]> {
  const rows = await query<{
    id: number;
    filename: string;
    position: number;
    alt_text: string;
  }>('SELECT id, filename, position, alt_text FROM action_posters ORDER BY position ASC');
  return rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    position: r.position,
    altText: r.alt_text,
  }));
}
```

3. In `HomePage()`, change the `Promise.all` to also fetch posters:

```ts
const [weeklyData, resolved, actionPosters] = await Promise.all([
  fetchWeeklyTabsData(currentWeekKey, nextWeekKey),
  Promise.all(
    nonWeeklyTypes.map(async (type) => {
      const [imageUrl, ocrData] = await Promise.all([resolveImage(type), fetchOcrData(type)]);
      return [type, imageUrl, ocrData] as const;
    })
  ),
  fetchActionPosters(),
]);
```

4. Change `visibleSections.action` to:

```ts
const visibleSections = {
  action: actionPosters.length > 0,
  weekly: !!(weeklyData.current || weeklyData.next),
  permanent: !!availability.permanent1,
};
```

5. Pass `actionPosters={actionPosters}` to `<MenuImages ... />`.

6. `nonWeeklyTypes` already filters out `weekly` — after removing `action` from `IMAGE_TYPES`, it'll be just `permanent*`. No change needed there.

- [ ] **Step 5: Run dev, verify homepage**

```bash
npm run dev
curl -s http://localhost:3008/ | grep -E '(id="action"|action_posters|/uploads/menu)'
```

Expected: no `id="action"` (empty table → section not rendered). No regression in `permanent`/`weekly` sections.

- [ ] **Step 6: Lint + TS check**

```bash
npm run lint
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/components/ActionPosters.tsx src/app/components/MenuImages.tsx src/app/page.tsx src/app/types.ts
git commit -m "feat: public ActionPosters section reading from action_posters"
```

---

## Task 10: Remove legacy `action` from admin upload UI

**Files:**
- Modify: `src/app/admin/page.tsx`

The TypeScript change in Task 9 (removing `'action'` from `IMAGE_TYPES`) will already break the admin file at compile time because `IMAGE_LABELS`, `existingImages`, `fileInputRefs` use `Record<ImageType, ...>`. Fix that here.

- [ ] **Step 1: Remove `action` keys from records**

In `src/app/admin/page.tsx`:

1. In `IMAGE_LABELS` (~line 50): remove the `action: 'Akce',` line.
2. In `existingImages` initial state (~line 88): remove `action: false,`.
3. In `images` initial state — uses `Object.fromEntries(IMAGE_TYPES.map(...))` so it auto-adjusts.
4. In `fileInputRefs` initial value (~line 96): remove `action: null,`.

- [ ] **Step 2: Remove `action` from admin UI JSX**

Find the JSX block that renders the "Akce" upload slot (search for `IMAGE_LABELS.action` or the `'action'` literal). It iterates over types — either the iteration auto-skips after IMAGE_TYPES change, or there's a hard-coded card. Inspect and delete the action card if hard-coded. The new ActionPostersAdmin component will be added in its place in Task 11.

```bash
grep -n "action" src/app/admin/page.tsx
```

Decide based on output. If the rendering iterates over `IMAGE_TYPES`, no JSX edit needed.

- [ ] **Step 3: Compile check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Smoke in browser**

`npm run dev`, log into `/admin`, verify the rest of the upload UI (weekly + permanent1..4) still renders and works. The "Akce" slot is gone.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat(admin): remove legacy single-action upload slot"
```

---

## Task 11: Admin component `ActionPostersAdmin`

**Files:**
- Create: `src/app/admin/ActionPostersAdmin.tsx`
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/app/admin/ActionPostersAdmin.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ActionPoster } from '@/app/types';
import { processImage } from '@/app/admin/processImage';

const UPLOADS_URL = process.env.NEXT_PUBLIC_UPLOADS_URL || '/uploads';

interface Props {
  onStatus: (type: 'success' | 'error', text: string) => void;
}

function PosterRow({
  poster,
  onDelete,
}: {
  poster: ActionPoster;
  onDelete: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: poster.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const ts = Date.now();
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 bg-zinc-900 border border-zinc-700 rounded p-2"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none px-2 text-zinc-400 hover:text-white"
        aria-label="Přesunout"
      >
        ≡
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${UPLOADS_URL}/menu/${poster.filename}?${ts}`}
        alt={poster.altText}
        className="h-24 w-auto object-contain"
        loading="lazy"
      />
      <div className="flex-1 text-sm text-zinc-300">#{poster.position} — {poster.altText}</div>
      <button
        type="button"
        onClick={() => onDelete(poster.id)}
        className="px-3 py-1 text-red-400 hover:text-red-200"
        aria-label="Smazat plakát"
      >
        ✕
      </button>
    </div>
  );
}

export default function ActionPostersAdmin({ onStatus }: Props) {
  const [posters, setPosters] = useState<ActionPoster[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = useCallback(async () => {
    const res = await fetch('/api/action-posters');
    if (res.ok) {
      const data = (await res.json()) as { posters: ActionPoster[] };
      setPosters(data.posters);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const processed = await processImage(file);
      const formData = new FormData();
      formData.append('file', processed, 'poster.webp');
      const res = await fetch('/api/action-posters', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('upload failed');
      const data = (await res.json()) as ActionPoster;
      setPosters((prev) => [...prev, data]);
      onStatus('success', 'Plakát nahrán.');
    } catch {
      onStatus('error', 'Chyba při nahrávání plakátu.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Opravdu smazat tento plakát?')) return;
    const prev = posters;
    setPosters((p) => p.filter((x) => x.id !== id));
    const res = await fetch(`/api/action-posters/${id}`, { method: 'DELETE' });
    if (res.ok) {
      load();
      onStatus('success', 'Plakát smazán.');
    } else {
      setPosters(prev);
      onStatus('error', 'Chyba při mazání.');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = posters.findIndex((p) => p.id === Number(active.id));
    const newIndex = posters.findIndex((p) => p.id === Number(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const previous = posters;
    const reordered = arrayMove(posters, oldIndex, newIndex).map((p, i) => ({
      ...p,
      position: i + 1,
    }));
    setPosters(reordered);
    const res = await fetch('/api/action-posters/order', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: reordered.map((p) => p.id) }),
    });
    if (!res.ok) {
      setPosters(previous);
      onStatus('error', 'Chyba při ukládání pořadí.');
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Akce — plakáty</h3>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-sm disabled:opacity-50"
        >
          {uploading ? 'Nahrávám…' : '+ Přidat plakát'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />
      </div>
      {posters.length === 0 ? (
        <p className="text-zinc-500 text-sm">Žádné plakáty zatím nejsou.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={posters.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {posters.map((p) => (
                <PosterRow key={p.id} poster={p} onDelete={handleDelete} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Wire into admin page**

In `src/app/admin/page.tsx`:

1. Import: `import ActionPostersAdmin from '@/app/admin/ActionPostersAdmin';`
2. Find the spot where the old "Akce" upload card used to live (or the most natural place in the admin UI, near the image upload section). Render:

```tsx
<ActionPostersAdmin onStatus={showStatus} />
```

`showStatus` is already a stable function in scope (`(type, text) => void`).

- [ ] **Step 3: Smoke test end-to-end**

`npm run dev`, log into `/admin`:
- Click "+ Přidat plakát" → choose an image → verify it appears in the list and on http://localhost:3008/ in the new section.
- Upload a second poster → verify both appear side-by-side on desktop.
- Drag-reorder → refresh public page → verify new order.
- Delete the first poster → verify the remaining poster gets `position=1` and the file is gone from `uploads/menu/`.

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: no new errors (some pre-existing `<img>` warnings are tolerated, consistent with the rest of the codebase).

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/ActionPostersAdmin.tsx src/app/admin/page.tsx
git commit -m "feat(admin): drag-and-drop ActionPostersAdmin"
```

---

## Task 12: Seed script for existing `action.webp`

**Files:**
- Create: `scripts/seed-action-posters.ts`

Idempotent: rename `action.webp` → `action-1.webp`, insert row, delete legacy `menu_images` row.

- [ ] **Step 1: Write script**

```ts
// scripts/seed-action-posters.ts
import { Pool } from 'pg';
import { existsSync, renameSync } from 'fs';
import path from 'path';

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/opt/hospodaracice/uploads';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const menuDir = path.join(UPLOADS_DIR, 'menu');
  const legacyPath = path.join(menuDir, 'action.webp');
  const targetPath = path.join(menuDir, 'action-1.webp');

  if (existsSync(targetPath)) {
    console.log('action-1.webp already exists — nothing to seed.');
  } else if (existsSync(legacyPath)) {
    renameSync(legacyPath, targetPath);
    console.log(`Renamed ${legacyPath} → ${targetPath}`);
    await pool.query(
      `INSERT INTO action_posters (filename, position, alt_text)
       SELECT 'action-1.webp', 1, 'Plakát akce'
       WHERE NOT EXISTS (SELECT 1 FROM action_posters)`
    );
    console.log('Inserted action_posters row for legacy action.webp.');
  } else {
    console.log('No legacy action.webp found — nothing to seed.');
  }

  await pool.query("DELETE FROM menu_images WHERE type = 'action'");
  console.log("Cleared legacy menu_images row for type='action'.");

  await pool.end();
  console.log('Seed complete.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Smoke locally (optional)**

If you have a local `action.webp` in `./uploads/menu/`:

```bash
node --env-file=.env --import tsx scripts/seed-action-posters.ts
```

Expected output ends with `Seed complete.`. Re-run — second invocation says `action-1.webp already exists`.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-action-posters.ts
git commit -m "feat(scripts): idempotent seed for existing action.webp"
```

---

## Task 13: Open PR

**Files:** none

- [ ] **Step 1: Push branch**

```bash
git push -u origin feat/action-posters
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat: multiple action posters with drag-and-drop reorder" --body "$(cat <<'EOF'
## Summary

Replaces the single ``action.webp`` slot with a flexible list of posters managed in admin via drag-and-drop. Public homepage renders them in an auto-fit grid on desktop and a horizontal swipe carousel on mobile.

- New ``action_posters`` table (migration 003)
- New API under ``/api/action-posters`` (GET, POST, DELETE, PATCH order)
- New ``ActionPosters`` (public) and ``ActionPostersAdmin`` (admin, ``@dnd-kit``) components
- Removed ``'action'`` from ``IMAGE_TYPES``
- Idempotent seed script for the existing ``action.webp`` on prod

Spec: ``docs/superpowers/specs/2026-05-15-multiple-action-posters-design.md``

## Test plan

- [x] ``npm run lint`` — clean
- [x] ``npx tsc --noEmit`` — clean
- [x] Manual: upload 1, 2, 3, 4, 6 posters, drag-reorder, delete middle — verified locally
- [ ] After deploy: run ``npx tsx scripts/seed-action-posters.ts`` on VPS to migrate existing ``action.webp`` as poster #1
- [ ] Smoke check homepage on prod

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Merge after review and return to main**

After self-review (the user reviews the PR or you ask them to), merge:

```bash
gh pr merge --merge --delete-branch
```

`gh pr merge` will fast-forward local `main` after the merge.

---

## Post-merge (separate, NOT in this plan's commits)

These are runtime ops, not part of the merged code:

- Deploy: `ssh root@204.168.176.128 'cd /opt/hospodaracice/app && bash scripts/deploy.sh'`
- One-time seed: `ssh root@204.168.176.128 'cd /opt/hospodaracice/app && node --env-file=.env --import tsx scripts/seed-action-posters.ts'`
- Smoke: `curl -s https://hospodaracice.cz/ | grep 'id="action"'` — should now show the section with the migrated poster.
