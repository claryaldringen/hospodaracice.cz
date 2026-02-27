# CLAUDE.md

Tento soubor poskytuje pokyny pro Claude Code (claude.ai/code) při práci s kódem v tomto repozitáři.

## Preference uživatele

- Uživatel se jmenuje Martin. Komunikuj s ním v češtině.

## Git workflow

- Když Martin řekne „udělej feature", znamená to celý flow: vytvoř branch → přepni do ní → implementuj → commitni → pushni → vytvoř PR → mergni do main → přepni zpět na main a pullni.
- Po mergnutí PR do `main` vždy automaticky přepni zpět na `main` a udělej `git pull`.

## Přehled projektu

Web pro "Hospodu Na Palouku" — restaurace v Račicích nad Berounkou. Stránka zobrazuje obrázky nabídek (akce, týdenní nabídka, stálá nabídka), které se spravují přes admin panel. UI je v češtině.

## Příkazy

- `npm run dev` — Spuštění dev serveru s Turbopackem (http://localhost:3000)
- `npm run build` — Produkční build
- `npm run lint` — ESLint + Prettier kontroly

## Tech stack

- **Next.js 15** (App Router) s React 19 a TypeScript
- **Tailwind CSS v4** (přes PostCSS plugin `@tailwindcss/postcss`)
- **Vercel Blob** (`@vercel/blob`) pro ukládání obrázků
- ESLint s `next/core-web-vitals`, `next/typescript` a `prettier` integrací
- Path alias: `@/*` → `./src/*`

## Architektura

Veškerý zdrojový kód je v `src/app/` dle konvence Next.js App Routeru.

**Stránky:**
- `page.tsx` — Veřejná homepage (client component). Načítá obrázky nabídek z Vercel Blob pomocí URL sestavených z `NEXT_PUBLIC_BLOB_BASE_URL`. Před vykreslením kontroluje dostupnost obrázků přes HEAD requesty. Zobrazuje tři sekce: akce, týdenní nabídka, stálá nabídka (4 obrázky v gridu).
- `admin/page.tsx` — Admin panel (client component). Chráněný heslem přes server-side session (cookie). Umožňuje nahrávání/mazání obrázků nabídek.

**API Routes:**
- `api/upload/route.ts` — POST: nahraje obrázek do Vercel Blob s pevným názvem souboru (`{type}.webp`). Autorizace přes session cookie.
- `api/delete/route.ts` — POST: smaže obrázek z Vercel Blob podle URL. Autorizace přes session cookie.

**Komponenty:**
- `components/Navigation.tsx` — Fixní header s responzivním hamburger menu. Položky navigace se zobrazují podmíněně podle toho, které sekce s obrázky mají obsah.
- `components/Footer.tsx` — Kontaktní údaje, otevírací doba, vložená mapa z Mapy.cz.

**Typy obrázků** jsou definovány jako union: `action | weekly | permanent1 | permanent2 | permanent3 | permanent4`. Tento typ je duplikován v `page.tsx` i `admin/page.tsx`.

## Proměnné prostředí

- `NEXT_PUBLIC_BLOB_BASE_URL` — Base URL pro Vercel Blob storage (používá se na klientu)
- `ADMIN_SECRET` — Heslo admina, používá se pro ověření hesla a podepisování session tokenů (pouze na serveru)
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob read/write token (pouze na serveru)

## Vlastní fonty

Dva vlastní fonty načtené v `globals.css` z `/public/`:
- `Cheque-Regular` (`.otf`) — použitý pro název hospody v headeru
- `bukhariscript` (`.ttf`) — použitý pro navigační odkazy
