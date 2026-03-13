# OCR extrakce textu z jídelníčků pro SEO

## Přehled

Při uploadu obrázku nabídky se v admin panelu (v prohlížeči) spustí Tesseract.js s českým jazykovým balíčkem (`ces`), extrahuje text a pošle ho na server spolu s obrázkem. Server uloží obrázek i extrahovaný text (jako JSON) do Vercel Blob. Homepage pak tento text načte a použije pro SEO — jako dynamický alt text a skrytý plný text pod obrázkem.

## Motivace

Vyhledávače nevidí text v obrázcích. Obrázky jídelníčků obsahují názvy jídel, ceny a popisy, které jsou cenné pro SEO. Extrakce tohoto textu umožní indexování obsahu nabídek.

## Technické řešení

### Závislosti

- `tesseract.js` — OCR engine běžící **v prohlížeči** (client-side) v admin panelu
- Český jazykový balíček (`ces`) se stáhne automaticky z CDN při prvním použití, prohlížeč ho cachuje

### Proč client-side OCR (ne serverové)

Tesseract.js má zdokumentované problémy s Vercel serverless prostředím (WASM resoluce, worker scripty, stahování jazykových dat při cold startu). V prohlížeči funguje spolehlivě — je pro něj primárně navržený. Admin panel už dělá client-side zpracování obrázků (resize, WebP konverze), takže OCR zapadá do stávajícího patternu.

### Admin panel — OCR flow (změny v `src/app/admin/page.tsx`)

1. Admin vybere obrázek → stávající `processImage()` provede resize a WebP konverzi
2. **Nově:** po zpracování obrázku se spustí Tesseract.js OCR s `lang: 'ces'`
3. Během OCR se zobrazí indikátor průběhu (Tesseract.js poskytuje progress callback)
4. Po dokončení OCR se extrahovaný text připojí k FormData jako nové pole `ocrText`
5. FormData se odešle na upload endpoint (obrázek + OCR text)

**Zpracování chyb OCR:**
- Pokud OCR selže (výjimka, timeout, prázdný výstup), upload obrázku proběhne normálně bez OCR textu
- Admin uvidí upozornění "OCR extrakce se nezdařila, obrázek byl nahrán bez textu"
- Žádný retry mechanismus — admin může smazat a znovu nahrát

### Upload endpoint (změny v `src/app/api/upload/route.ts`)

1. Stávající logika uloží `{type}.webp` do Vercel Blob
2. **Nově:** pokud FormData obsahuje `ocrText`, vytvoří se `altText` (prvních max 150 znaků, oříznutý na hranici slova) a uloží se `{type}.json` do Vercel Blob:

```json
{
  "fullText": "Celý extrahovaný text z obrázku...",
  "altText": "Prvních max 150 znaků oříznutých na hranici slova..."
}
```

JSON se ukládá s `contentType: 'application/json'` a `access: 'public'`.

3. Endpoint vrátí rozšířenou odpověď:

```json
{
  "url": "https://.../{type}.webp",
  "ocrUrl": "https://.../{type}.json"
}
```

### Delete endpoint (změny v `src/app/api/delete/route.ts`)

1. **Nově:** endpoint přijímá navíc parametr `type` v request body
2. Smaže obrázek (stávající logika přes URL)
3. Pokusí se smazat i `{type}.json` z Blobu — pokud neexistuje, ignoruje 404

Změna API kontraktu:
```json
// Dosud:
{ "url": "https://.../{type}.webp" }

// Nově:
{ "url": "https://.../{type}.webp", "type": "action" }
```

Admin panel (`admin/page.tsx`) se upraví, aby posílal i `type`.

### Homepage — server část (změny v `src/app/page.tsx`)

Pro každý dostupný obrázek se načte odpovídající JSON:

```typescript
// Pro každý typ, kde existuje obrázek:
const ocrResponse = await fetch(`${baseUrl}/${type}.json`, {
  next: { revalidate: 60 }
})
if (ocrResponse.ok) {
  ocrData[type] = await ocrResponse.json()
}
// Pokud JSON neexistuje (404), ocrData pro daný typ zůstane undefined
```

Data se předají do `MenuImages` jako nový prop `ocrData: Record<string, ImageOcrData | undefined>`.

### Homepage — klient (změny v `src/app/components/MenuImages.tsx`)

1. Nový prop: `ocrData: Record<string, ImageOcrData | undefined>`
2. `alt` atribut = `ocrData[type]?.altText` s fallbackem na stávající statický text ("Akce Letáček" atd.)
3. Pod každým obrázkem: `<div className="sr-only">{ocrData[type]?.fullText}</div>` — pouze pokud fullText existuje

### Datový formát

```typescript
interface ImageOcrData {
  fullText: string   // Celý extrahovaný text
  altText: string    // Max ~150 znaků, oříznutý na hranici slova
}
```

### Formát uložení v Blob

Soubory se ukládají vedle obrázků se stejným naming convention:
- `action.webp` → `action.json`
- `weekly.webp` → `weekly.json`
- `permanent1.webp` → `permanent1.json`
- atd.

## Omezení

- Tesseract.js nemusí být 100% přesný u stylizovaných fontů — ale i neperfektní text je lepší pro SEO než žádný
- Upload bude o několik sekund pomalejší kvůli OCR zpracování v prohlížeči
- Jazykový balíček (`ces`, ~10-15 MB) se stáhne z CDN při prvním OCR volání v dané browser session, pak je cachovaný prohlížečem
- Stávající obrázky nebudou mít OCR text — admin je může znovu nahrát pro extrakci

## Infrastruktura

Žádná nová infrastruktura. Vše běží v rámci stávajícího Vercel Blob, Next.js API routes a admin prohlížeče.

## Dotčené soubory

- `src/app/admin/page.tsx` — client-side OCR při uploadu, posílání `type` při delete
- `src/app/api/upload/route.ts` — příjem OCR textu, ukládání JSON do Blobu
- `src/app/api/delete/route.ts` — příjem `type`, mazání JSON při smazání obrázku
- `src/app/page.tsx` — načítání JSON dat při renderování, předání do MenuImages
- `src/app/components/MenuImages.tsx` — dynamický alt text + skrytý sr-only text
- `package.json` — nová závislost `tesseract.js`
