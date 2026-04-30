# CLAUDE.md

Tento soubor poskytuje pokyny pro Claude Code (claude.ai/code) při práci s kódem v tomto repozitáři.

## Preference uživatele

- Uživatel se jmenuje Martin. Komunikuj s ním v češtině.

## Git workflow

- Když Martin řekne „udělej feature", znamená to celý flow: vytvoř branch → přepni do ní → implementuj → commitni → pushni → vytvoř PR → mergni do main → přepni zpět na main a pullni.
- Po mergnutí PR do `main` vždy automaticky přepni zpět na `main` a udělej `git pull`.

## Přehled projektu

Web pro „Hospodu Na Palouku" — restaurace v Račicích nad Berounkou. Stránka zobrazuje obrázky nabídek (akce, týdenní nabídka, stálá nabídka), galerii a umožňuje rezervace stolů a objednávky jídel s rozvozem. UI je v češtině.

## Nasazení

- **Hosting:** Hetzner VPS
- **Process manager:** PM2 (Next.js běží na portu 3002)
- **Reverse proxy:** Caddy
- **Databáze:** PostgreSQL na stejném VPS
- **Úložiště souborů:** lokální filesystem VPS (`/opt/hospodaracice/uploads/`), servírované Caddym
- Pro práci se serverem použij skill `vps-devops`.

## Příkazy

- `npm run dev` — Spuštění dev serveru s Turbopackem (http://localhost:3008)
- `npm run build` — Produkční build
- `npm run lint` — ESLint + Prettier kontroly
- `npm run db:migrate` — Spuštění SQL migrací z `db/migrations/`
- `npm run migrate:data` — One-shot migrace dat (např. import ze starých zdrojů)

## Tech stack

- **Next.js 15** (App Router) s React 19 a TypeScript
- **Tailwind CSS v4** (přes PostCSS plugin `@tailwindcss/postcss`)
- **PostgreSQL** přes `pg` driver (connection pool v `src/app/lib/db.ts`)
- **Resend** pro odesílání emailů (rezervace, objednávky)
- **Anthropic SDK** (`@anthropic-ai/sdk`) pro Claude Vision — extrakce strukturovaného jídelníčku z nahrávaného obrázku týdenní nabídky
- ESLint s `next/core-web-vitals`, `next/typescript` a `prettier` integrací
- Path alias: `@/*` → `./src/*`

## Architektura

Veškerý zdrojový kód aplikace je v `src/app/` dle konvence Next.js App Routeru.

**Stránky:**
- `page.tsx` — Veřejná homepage (server component, `dynamic = 'force-dynamic'`). Načte otevírací dobu a OCR alt-texty z DB, zkontroluje existenci souborů obrázků na disku a vyrenderuje sekce nabídek + galerii.
- `admin/page.tsx` — Admin panel (client component). Chráněn heslem přes server-side session (HMAC-podepsaná cookie). Umožňuje nahrávání/mazání obrázků nabídek, správu otevírací doby, přehled rezervací, přehled objednávek (po týdnech / po obcích), správu obcí pro rozvoz a galerie. Session perzistuje přes refresh (kontroluje se přes `GET /api/auth`).
- `rezervace/page.tsx` — Veřejný rezervační formulář s GDPR souhlasem. Host zadá jméno, email, počet míst, datum a čas. Zobrazuje obsazenost po hodinách.
- `objednavka/page.tsx` — Veřejný objednávkový formulář. Zákazník vybere den (uzávěrka 10:00 den předem), jídla z nabídky (+/- počet), vyplní doručovací údaje a odešle objednávku.
- `ochrana-osobnich-udaju/page.tsx` — GDPR-compliant stránka se zásadami zpracování osobních údajů.

**API Routes (`src/app/api/`):**
- `auth/route.ts` — POST: přihlášení (heslem proti `ADMIN_SECRET`), nastaví session cookie. GET: validace existující session.
- `auth/logout/route.ts` — POST: odhlášení (vymaže cookie).
- `upload/route.ts` — POST: přijme obrázek, uloží na disk jako `{type}.webp`, u typu `weekly` extrahuje strukturovanou nabídku přes Claude Haiku Vision a uloží ji do tabulky `weekly_menu` + alt-text do `menu_images`.
- `delete/route.ts` — POST: smaže obrázek z disku a souvisejícího řádku v `menu_images` / `weekly_menu`.
- `opening-hours/route.ts` — GET (veřejné) / POST (admin): čte/zapisuje text otevírací doby do DB.
- `menu/route.ts` — GET: vrátí strukturovaný týdenní jídelníček z tabulky `weekly_menu`.
- `delivery-villages/route.ts` — GET (veřejné) / POST (admin): seznam obcí pro rozvoz.
- `orders/route.ts` — POST (veřejné): vytvoří objednávku v DB a pošle emailem na `ORDER_EMAIL`.
- `orders/list/route.ts` — GET (admin): seznam objednávek pro zadané datum.
- `orders/counts/route.ts` — GET (admin): počty objednávek po datech v zadaném rozsahu (pro disabled stavy v admin date selectu).
- `reservations/route.ts` — POST (veřejné): vytvoří rezervaci ve stavu `pending` a pošle potvrzovací email.
- `reservations/availability/route.ts` — GET (veřejné): obsazenost po hodinách pro daný den.
- `reservations/confirm/route.ts` — GET: potvrdí rezervaci přes token z emailu.
- `reservations/cancel/route.ts` — GET: zruší rezervaci přes token z emailu.
- `reservations/list/route.ts` — GET (admin): seznam rezervací na den.
- `reservations/admin-cancel/route.ts` — POST (admin): zruší rezervaci podle ID.
- `gallery/route.ts` — GET (veřejné) / POST + DELETE (admin): seznam, upload a mazání položek galerie (obrázky + videa).

**Komponenty (`src/app/components/`):**
- `Navigation.tsx` — Fixní header s responzivním hamburger menu. Položky se zobrazují podmíněně podle dostupných sekcí.
- `Footer.tsx` — Kontaktní údaje, otevírací doba, vložená mapa z Mapy.cz, právní patička s odkazem na zásady ochrany osobních údajů.
- `MenuImages.tsx` — Vykreslení sekcí akce / týdenní nabídka / stálá nabídka. Používá nativní `<img>` (ne Next/Image) — viz historická poznámka níže.
- `Gallery.tsx` — Veřejná galerie obrázků a videí.
- `OrderForm.tsx` — Klientská část objednávkového formuláře (uzávěrka 10:00 den předem, GDPR souhlas, scroll-to-top po odeslání).

**Lib (`src/app/lib/`):**
- `db.ts` — `pg` connection pool (`DATABASE_URL`), helpery `query` a `queryOne`.
- `storage.ts` — Lokální filesystem helper (`saveFile`, `deleteFile`, `fileExists`, `getFilePath`, `getPublicUrl`). Cesty řízeny `UPLOADS_DIR` a `NEXT_PUBLIC_UPLOADS_URL`.
- `auth.ts` — HMAC-podepsané session tokeny v cookie (24h expirace), helper `isAuthenticated`.
- `reservations.ts` — CRUD nad tabulkou `reservations`, kontrola kapacity (`TOTAL_SEATS`), pending rezervace platí 30 min.
- `orders.ts` — CRUD nad tabulkou `orders`.
- `email.ts` — Odesílání rezervačních emailů přes Resend.

**Typy (`src/app/types.ts`):**
- `IMAGE_TYPES` (single source of truth): `action | weekly | permanent1 | permanent2 | permanent3 | permanent4`.
- Doménové interface: `Reservation`, `WeeklyMenu`, `MenuDay`, `MenuItem`, `Order`, `OrderItem`, `GalleryItem`, `ImageOcrData`.

**Databáze (`db/migrations/`):**
- Migrace v SQL souborech (běží přes `db/migrate.ts`, který si vede tabulku `_migrations`).
- Tabulky: `opening_hours`, `delivery_villages`, `weekly_menu` (JSONB), `menu_images` (OCR alt-texty), `gallery`, `reservations`, `orders`.

## Proměnné prostředí

- `DATABASE_URL` — Connection string do PostgreSQL (server-only)
- `UPLOADS_DIR` — Absolutní cesta ke složce s uploady na disku (default `./uploads`, na produkci `/opt/hospodaracice/uploads`)
- `NEXT_PUBLIC_UPLOADS_URL` — Veřejná URL pro servírování uploadů (default `/uploads`)
- `ADMIN_SECRET` — Heslo admina + klíč pro podepisování session tokenů (server-only)
- `ANTHROPIC_API_KEY` — API klíč pro Claude Vision (extrakce jídelníčku, server-only)
- `RESEND_API_KEY` — API klíč pro Resend (server-only)
- `TOTAL_SEATS` — Celková kapacita hospody pro rezervace (default 40, server-only)
- `NEXT_PUBLIC_BASE_URL` — Veřejná URL webu (pro odkazy v emailech)
- `ORDER_EMAIL` — Cílový email pro notifikace objednávek (server-only)

## Vlastní fonty

Dva vlastní fonty načtené v `globals.css` z `/public/`:
- `Cheque-Regular` (`.otf`) — použitý pro název hospody v headeru
- `bukhariscript` (`.ttf`) — použitý pro navigační odkazy

## Historické poznámky

- Projekt byl původně nasazen na Vercelu s Vercel Blob storage a JSON soubory; v dubnu 2026 migrován na Hetzner VPS + PostgreSQL + lokální filesystem. Plán migrace: `docs/superpowers/plans/2026-04-10-vps-migration.md`.
- `MenuImages` používá nativní `<img>` místo `next/image`, protože Next.js Image optimization při výchozí konfiguraci servírovala obrázky v 4K. Obrázky se nyní pre-konvertují do optimalizovaného WebP přímo na serveru (viz uploads/ pipeline).
