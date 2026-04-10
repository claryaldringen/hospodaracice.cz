# OCR SEO Extraction Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract text from uploaded menu images using client-side Tesseract.js OCR and use it for SEO (dynamic alt text + hidden sr-only text).

**Architecture:** OCR runs in the admin browser after image processing. Extracted text is sent to the upload API alongside the image, which stores it as a JSON file in Vercel Blob. The homepage fetches these JSON files and passes the text to MenuImages for SEO rendering.

**Tech Stack:** Tesseract.js (browser OCR), Next.js 15 App Router, Vercel Blob, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-13-ocr-seo-extraction-design.md`

---

## Chunk 1: Dependencies and Types

### Task 1: Install tesseract.js

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install tesseract.js**

```bash
npm install tesseract.js
```

- [ ] **Step 2: Verify installation**

```bash
npm ls tesseract.js
```

Expected: `tesseract.js@X.X.X` listed

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add tesseract.js dependency for OCR"
```

### Task 2: Add ImageOcrData type

**Files:**
- Modify: `src/app/types.ts`

- [ ] **Step 1: Add ImageOcrData interface to types.ts**

Add after the existing `ImageType` export:

```typescript
export interface ImageOcrData {
  fullText: string;
  altText: string;
}
```

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/types.ts
git commit -m "feat: add ImageOcrData type"
```

---

## Chunk 2: API Routes

### Task 3: Update upload API to store OCR JSON

**Files:**
- Modify: `src/app/api/upload/route.ts`

- [ ] **Step 1: Add OCR text handling to upload route**

Replace the entire contents of `src/app/api/upload/route.ts` with:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { isAuthenticated } from '@/app/lib/auth';

function createAltText(fullText: string): string {
  if (fullText.length <= 150) return fullText;
  const truncated = fullText.slice(0, 150);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const type = formData.get('type') as string;
  const ocrText = formData.get('ocrText') as string | null;

  if (!file || !type) {
    return NextResponse.json({ message: 'File or type not provided' }, { status: 400 });
  }

  const filename = `${type}.webp`;

  const blob = await put(filename, file, {
    access: 'public',
    token: process.env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: false,
  });

  let ocrUrl: string | undefined;

  if (ocrText && ocrText.trim().length > 0) {
    const ocrData = {
      fullText: ocrText.trim(),
      altText: createAltText(ocrText.trim()),
    };
    const jsonBlob = await put(`${type}.json`, JSON.stringify(ocrData), {
      access: 'public',
      contentType: 'application/json',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
    });
    ocrUrl = jsonBlob.url;
  }

  return NextResponse.json({ url: blob.url, ocrUrl });
}
```

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/upload/route.ts
git commit -m "feat: store OCR text as JSON in Blob on upload"
```

### Task 4: Update delete API to remove OCR JSON

**Files:**
- Modify: `src/app/api/delete/route.ts`

- [ ] **Step 1: Add type parameter and JSON deletion**

Replace the entire contents of `src/app/api/delete/route.ts` with:

```typescript
import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { isAuthenticated } from '@/app/lib/auth';

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { url, type } = await req.json();

  if (!url) {
    return NextResponse.json({ message: 'No URL provided' }, { status: 400 });
  }

  try {
    await del(url, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // Also delete the companion OCR JSON if type is provided
    if (type) {
      const jsonUrl = `${process.env.NEXT_PUBLIC_BLOB_BASE_URL}/${type}.json`;
      try {
        await del(jsonUrl, {
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
      } catch {
        // JSON may not exist — ignore
      }
    }

    return NextResponse.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Failed to delete the file' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/delete/route.ts
git commit -m "feat: delete companion OCR JSON when deleting image"
```

---

## Chunk 3: Admin Panel OCR Integration

### Task 5: Add client-side OCR to admin upload flow

**Files:**
- Modify: `src/app/admin/page.tsx`

This task modifies the admin page to:
1. Run Tesseract.js OCR after image processing
2. Send extracted text with upload FormData
3. Send `type` with delete requests
4. Show OCR progress indicator

> **Note:** Line numbers in Steps 3-5 reference the **original** file before Steps 1-2 modifications. After Steps 1-2 add ~15 lines, all subsequent line references shift by ~15. Use function names/comments to locate the correct positions.

- [ ] **Step 1: Add OCR helper function after the `processImage` function (after line 41)**

```typescript
async function extractText(imageBlob: Blob): Promise<string | null> {
  try {
    const result = await Promise.race([
      (async () => {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('ces', undefined, {
          logger: () => {},
        });
        const { data } = await worker.recognize(imageBlob);
        await worker.terminate();
        return data.text.trim();
      })(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 30000)),
    ]);
    return result && result.length > 0 ? result : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Add `ocrProgress` state to the component (after line 72)**

```typescript
const [ocrProgress, setOcrProgress] = useState<Record<ImageType, boolean>>(
  Object.fromEntries(IMAGE_TYPES.map((type) => [type, false])) as Record<ImageType, boolean>
);
```

- [ ] **Step 3: Update `handleUpload` to run OCR and include text in FormData**

Replace the `handleUpload` function (lines 154-183) with:

```typescript
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: ImageType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let processed: Blob;
    try {
      processed = await processImage(file);
    } catch {
      showStatus('error', 'Chyba při zpracování obrázku.');
      return;
    }

    // Run OCR
    setOcrProgress((prev) => ({ ...prev, [type]: true }));
    const ocrText = await extractText(processed);
    setOcrProgress((prev) => ({ ...prev, [type]: false }));

    const formData = new FormData();
    formData.append('file', processed, `${type}.webp`);
    formData.append('type', type);
    if (ocrText) {
      formData.append('ocrText', ocrText);
    }

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      setImages((prev) => ({ ...prev, [type]: `${data.url}?${new Date().getTime()}` }));
      setExistingImages((prev) => ({ ...prev, [type]: true }));
      if (ocrText) {
        showStatus('success', 'Soubor úspěšně nahrán s OCR textem!');
      } else {
        showStatus('success', 'Soubor nahrán (OCR extrakce se nezdařila).');
      }
    } else {
      showStatus('error', 'Chyba při nahrávání souboru.');
    }
  };
```

- [ ] **Step 4: Update `handleDelete` to send `type` parameter**

Replace the `handleDelete` function (lines 185-201) with:

```typescript
  const handleDelete = async (type: ImageType) => {
    if (!images[type]) return;

    // Strip cache-busting query parameter before sending to delete API
    const cleanUrl = images[type]!.split('?')[0];

    const res = await fetch('/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: cleanUrl, type }),
    });

    if (res.ok) {
      setImages((prev) => ({ ...prev, [type]: null }));
      setExistingImages((prev) => ({ ...prev, [type]: false }));
      showStatus('success', `Obrázek „${IMAGE_LABELS[type]}" byl odstraněn!`);
    } else {
      showStatus('error', 'Chyba při mazání souboru.');
    }
  };
```

- [ ] **Step 5: Add OCR progress indicator to the card UI**

In the image preview section (around line 361), after the existing image/placeholder rendering, add an OCR progress overlay. Replace the `{/* Image preview */}` block (lines 360-384) with:

```tsx
              {/* Image preview */}
              <div className="relative px-5 pt-4">
                {existingImages[type] && images[type] ? (
                  <img
                    src={images[type]!}
                    alt={IMAGE_LABELS[type]}
                    className="h-48 w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-48 w-full items-center justify-center rounded-lg bg-gray-100">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1}
                      stroke="currentColor"
                      className="h-12 w-12 text-gray-300"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
                      />
                    </svg>
                  </div>
                )}
                {ocrProgress[type] && (
                  <div className="absolute inset-x-5 inset-y-4 flex items-center justify-center rounded-lg bg-black/50">
                    <span className="text-sm font-medium text-white">Rozpoznávání textu…</span>
                  </div>
                )}
              </div>
```

- [ ] **Step 6: Verify no type errors**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: add client-side OCR extraction in admin upload"
```

---

## Chunk 4: Homepage SEO Rendering

### Task 6: Fetch OCR data on homepage and render for SEO

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/components/MenuImages.tsx`

> **Note:** Both files are modified in a single task/commit to avoid a broken intermediate state (page.tsx passing a prop that MenuImages doesn't accept yet).

- [ ] **Step 1: Update homepage to fetch OCR JSON files**

Replace the entire contents of `src/app/page.tsx` with:

```typescript
import Footer from '@/app/components/Footer';
import Navigation from '@/app/components/Navigation';
import MenuImages from '@/app/components/MenuImages';
import { IMAGE_TYPES, type ImageOcrData } from '@/app/types';

export const revalidate = 60;

const baseUrl = process.env.NEXT_PUBLIC_BLOB_BASE_URL;

async function checkImageExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', next: { revalidate: 60 } });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchOcrData(type: string): Promise<ImageOcrData | undefined> {
  try {
    const res = await fetch(`${baseUrl}/${type}.json`, { next: { revalidate: 60 } });
    if (res.ok) return await res.json();
  } catch {
    // JSON may not exist
  }
  return undefined;
}

export default async function HomePage() {
  const resolved = await Promise.all(
    IMAGE_TYPES.map(async (type) => {
      const [imageUrl, ocrData] = await Promise.all([
        (async () => {
          const webpUrl = `${baseUrl}/${type}.webp`;
          if (await checkImageExists(webpUrl)) return webpUrl;
          const jpgUrl = `${baseUrl}/${type}.jpg`;
          if (await checkImageExists(jpgUrl)) return jpgUrl;
          return null;
        })(),
        fetchOcrData(type),
      ]);
      return [type, imageUrl, ocrData] as const;
    })
  );

  const availableImages: Record<string, string> = {};
  const ocrDataMap: Record<string, ImageOcrData> = {};
  const availability: Record<string, boolean> = {};

  for (const [type, url, ocrData] of resolved) {
    availability[type] = url !== null;
    if (url) availableImages[type] = url;
    if (ocrData) ocrDataMap[type] = ocrData;
  }

  const visibleSections = {
    action: !!availability.action,
    weekly: !!availability.weekly,
    permanent: !!availability.permanent1,
  };

  return (
    <div>
      <Navigation visibleImages={visibleSections} />
      <main className="pt-12 bg-black">
        <MenuImages
          availableImages={availableImages}
          visibleSections={visibleSections}
          ocrData={ocrDataMap}
        />
        <Footer />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Update MenuImages component**

Replace the entire contents of `src/app/components/MenuImages.tsx` with:

```typescript
import NextImage from 'next/image';
import type { ImageOcrData } from '@/app/types';

interface MenuImagesProps {
  availableImages: Record<string, string>;
  visibleSections: {
    action: boolean;
    weekly: boolean;
    permanent: boolean;
  };
  ocrData: Record<string, ImageOcrData>;
}

export default function MenuImages({ availableImages, visibleSections, ocrData }: MenuImagesProps) {
  const firstVisibleSection = visibleSections.action
    ? 'action'
    : visibleSections.weekly
      ? 'weekly'
      : null;

  return (
    <>
      {visibleSections.action && availableImages.action && (
        <section id="action">
          <div className="relative w-full h-screen mt-4 mb-4">
            <NextImage
              src={availableImages.action}
              alt={ocrData.action?.altText || 'Akce Letáček'}
              fill
              sizes="100vw"
              priority={firstVisibleSection === 'action'}
              style={{ objectFit: 'contain' }}
              className="shadow-lg"
            />
          </div>
          {ocrData.action?.fullText && (
            <div className="sr-only">{ocrData.action.fullText}</div>
          )}
        </section>
      )}

      {visibleSections.weekly && availableImages.weekly && (
        <section id="weekly">
          <div className="relative w-full h-screen mt-4 mb-4">
            <NextImage
              src={availableImages.weekly}
              alt={ocrData.weekly?.altText || 'Týdenní Nabídka'}
              fill
              sizes="100vw"
              priority={firstVisibleSection === 'weekly'}
              style={{ objectFit: 'contain' }}
              className="shadow-lg"
            />
          </div>
          {ocrData.weekly?.fullText && (
            <div className="sr-only">{ocrData.weekly.fullText}</div>
          )}
        </section>
      )}

      {visibleSections.permanent && (
        <section id="permanent" className="grid grid-cols-1 md:grid-cols-2">
          {['permanent1', 'permanent2', 'permanent3', 'permanent4'].map(
            (key, index) =>
              availableImages[key] && (
                <div
                  key={key}
                  className={`relative w-full h-screen flex ${
                    index % 2 === 0 ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <NextImage
                    src={availableImages[key]}
                    width={800}
                    height={1200}
                    sizes="(max-width: 768px) 100vw, 50vw"
                    alt={ocrData[key]?.altText || `Stálá Nabídka ${index + 1}`}
                    className="h-auto max-h-screen max-w-full object-contain"
                  />
                  {ocrData[key]?.fullText && (
                    <div className="sr-only">{ocrData[key].fullText}</div>
                  )}
                </div>
              )
          )}
        </section>
      )}
    </>
  );
}
```

- [ ] **Step 3: Verify no type errors**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 4: Verify the build succeeds**

```bash
npm run build
```

Expected: Build completes successfully

- [ ] **Step 5: Verify lint passes**

```bash
npm run lint
```

Expected: No errors

- [ ] **Step 6: Commit both files together**

```bash
git add src/app/page.tsx src/app/components/MenuImages.tsx
git commit -m "feat: fetch and render OCR text on homepage for SEO"
```
