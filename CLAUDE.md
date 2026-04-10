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
- `admin/page.tsx` — Admin panel (client component). Chráněný heslem přes server-side session (cookie). Umožňuje nahrávání/mazání obrázků nabídek, správu otevírací doby, přehled rezervací a správu obcí pro rozvoz.
- `rezervace/page.tsx` — Veřejný rezervační formulář. Host zadá jméno, email, počet míst, datum a čas. Zobrazuje obsazenost po hodinách.
- `objednavka/page.tsx` — Veřejný objednávkový formulář. Zákazník vybere den, jídla z nabídky (+/- počet), vyplní doručovací údaje (jméno, telefon, adresa, obec). Objednávka se pošle emailem.

**API Routes:**
- `api/upload/route.ts` — POST: nahraje obrázek do Vercel Blob s pevným názvem souboru (`{type}.webp`). Po uploadu extrahuje text přes Claude Vision (Haiku). Autorizace přes session cookie.
- `api/delete/route.ts` — POST: smaže obrázek z Vercel Blob podle URL. Autorizace přes session cookie.
- `api/opening-hours/route.ts` — GET/POST: načte/uloží otevírací dobu jako JSON v Blob.
- `api/reservations/route.ts` — POST: vytvoří novou rezervaci (veřejné).
- `api/reservations/availability/route.ts` — GET: obsazenost po hodinách pro daný den (veřejné).
- `api/reservations/confirm/route.ts` — GET: potvrdí rezervaci přes token z emailu.
- `api/reservations/cancel/route.ts` — GET: zruší rezervaci přes token z emailu.
- `api/reservations/list/route.ts` — GET: seznam rezervací na den (admin).
- `api/reservations/admin-cancel/route.ts` — POST: admin zruší rezervaci podle ID.
- `api/menu/route.ts` — GET: strukturovaná týdenní nabídka z `weekly-menu.json` (veřejné).
- `api/delivery-villages/route.ts` — GET/POST: seznam obcí pro rozvoz.
- `api/orders/route.ts` — POST: odešle objednávku emailem na `ORDER_EMAIL` (veřejné).

**Komponenty:**
- `components/Navigation.tsx` — Fixní header s responzivním hamburger menu. Položky navigace se zobrazují podmíněně podle toho, které sekce s obrázky mají obsah.
- `components/Footer.tsx` — Kontaktní údaje, otevírací doba, vložená mapa z Mapy.cz.

**Lib:**
- `lib/reservations.ts` — Čtení/zápis `reservations.json` z Blob, kontrola kapacity, cleanup starých záznamů.
- `lib/email.ts` — Odesílání potvrzovacích emailů přes Resend.

**Typy obrázků** jsou definovány jako union: `action | weekly | permanent1 | permanent2 | permanent3 | permanent4`. Tento typ je duplikován v `page.tsx` i `admin/page.tsx`.

## Proměnné prostředí

- `NEXT_PUBLIC_BLOB_BASE_URL` — Base URL pro Vercel Blob storage (používá se na klientu)
- `ADMIN_SECRET` — Heslo admina, používá se pro ověření hesla a podepisování session tokenů (pouze na serveru)
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob read/write token (pouze na serveru)
- `ANTHROPIC_API_KEY` — API klíč pro Claude Vision (extrakce textu z obrázků, pouze na serveru)
- `TOTAL_SEATS` — Celková kapacita hospody pro rezervační systém (pouze na serveru)
- `RESEND_API_KEY` — API klíč pro Resend (odesílání emailů, pouze na serveru)
- `NEXT_PUBLIC_BASE_URL` — Veřejná URL webu pro odkazy v emailech
- `ORDER_EMAIL` — Emailová adresa hospody pro příjem objednávek (pouze na serveru)

## Vlastní fonty

Dva vlastní fonty načtené v `globals.css` z `/public/`:
- `Cheque-Regular` (`.otf`) — použitý pro název hospody v headeru
- `bukhariscript` (`.ttf`) — použitý pro navigační odkazy
