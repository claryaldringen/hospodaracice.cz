# OCR extrakce textu z jídelníčků pro SEO

## Přehled

Při uploadu obrázku nabídky se na serveru spustí Tesseract.js s českým jazykovým balíčkem (`ces`), extrahuje text a uloží ho jako JSON do Vercel Blob vedle obrázku. Homepage pak tento text načte a použije pro SEO — jako dynamický alt text a skrytý plný text pod obrázkem.

## Motivace

Vyhledávače nevidí text v obrázcích. Obrázky jídelníčků obsahují názvy jídel, ceny a popisy, které jsou cenné pro SEO. Extrakce tohoto textu umožní indexování obsahu nabídek.

## Technické řešení

### Závislosti

- `tesseract.js` — OCR engine běžící na serveru v API route
- Český jazykový balíček (`ces`) se stáhne automaticky při prvním použití, pak se cachuje

### Upload flow (změny v `src/app/api/upload/route.ts`)

1. Admin nahraje obrázek — stávající logika uloží `{type}.webp` do Vercel Blob
2. **Nově:** server pošle nahraný obrázek do Tesseract.js s `lang: 'ces'`
3. Extrahovaný text se uloží jako `{type}.json` do Vercel Blob ve formátu:

```json
{
  "fullText": "Celý extrahovaný text z obrázku...",
  "altText": "Prvních ~150 znaků textu..."
}
```

4. Upload endpoint vrátí URL obrázku i JSON (jako dosud + nové pole)

### Delete flow (změny v `src/app/api/delete/route.ts`)

Při smazání obrázku se smaže i odpovídající `{type}.json` z Vercel Blob.

### Homepage — server část (změny v `src/app/page.tsx`)

1. Při renderování stránky se pro každý dostupný obrázek načte i `{type}.json` z Blobu
2. JSON data se předají do `MenuImages` componentu jako nový prop (vedle URL obrázku)
3. Pokud JSON neexistuje (starší obrázky), použije se stávající hardcoded alt text jako fallback

### Homepage — klient (změny v `src/app/components/MenuImages.tsx`)

1. `alt` atribut obrázku = `altText` z JSON (místo hardcoded "Akce Letáček" atd.)
2. Pod každým obrázkem skrytý `<div className="sr-only">{fullText}</div>` s plným extrahovaným textem
3. Fallback na stávající statické alt texty, pokud JSON data nejsou k dispozici

### Datový formát JSON

```typescript
interface ImageOcrData {
  fullText: string   // Celý extrahovaný text
  altText: string    // Zkrácený text (max ~150 znaků) pro alt atribut
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
- Upload bude o několik sekund pomalejší kvůli OCR zpracování
- Jazykový balíček se musí stáhnout při prvním OCR volání (pak je cachovaný)

## Infrastruktura

Žádná nová infrastruktura není potřeba. Vše běží v rámci stávajícího Vercel Blob a Next.js API routes.

## Dotčené soubory

- `src/app/api/upload/route.ts` — přidání OCR a ukládání JSON
- `src/app/api/delete/route.ts` — mazání JSON při smazání obrázku
- `src/app/page.tsx` — načítání JSON dat při renderování
- `src/app/components/MenuImages.tsx` — dynamický alt text + skrytý text
- `package.json` — nová závislost `tesseract.js`
