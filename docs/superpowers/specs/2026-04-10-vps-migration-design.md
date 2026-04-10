# Migrace hospodaracice.cz na Hetzner VPS

## Přehled

Migrace z Vercel (serverless + Vercel Blob) na self-hosted Hetzner VPS (standalone Next.js + PostgreSQL + lokální soubory). Cíl: nižší náklady, plná kontrola nad infrastrukturou, robustnější datový model.

## Cílový server

- **IP:** 204.168.176.128
- **OS:** Ubuntu 24.04 LTS (ARM64)
- **Zdroje:** 2 vCPU, 4 GB RAM, 38 GB disk (27 GB volných)
- **Existující služby:** Caddy (reverse proxy), PostgreSQL 16, PM2, Node.js v24, sfingee.com na portu 3000

## Architektura

### Domény

- **Primární:** `hospodaracice.cz`
- **Přesměrování (301):** `hospodanapalouku.cz`, `racickahospoda.cz`, `restauracenapalouku.cz`
- **www varianty:** všechny přesměrovány na `https://hospodaracice.cz`
- **Registrátor:** Subreg — nastavit A záznamy (@ + www) na 204.168.176.128 pro všechny 4 domény

### Caddy konfigurace

```caddy
hospodaracice.cz {
    handle /uploads/* {
        root * /opt/hospodaracice
        file_server {
            precompressed gzip
        }
        header Cache-Control "public, max-age=31536000, immutable"
    }

    handle {
        reverse_proxy localhost:3002
    }
}

hospodanapalouku.cz, racickahospoda.cz, restauracenapalouku.cz {
    redir https://hospodaracice.cz{uri} permanent
}

www.hospodaracice.cz, www.hospodanapalouku.cz, www.racickahospoda.cz, www.restauracenapalouku.cz {
    redir https://hospodaracice.cz{uri} permanent
}
```

- Port 3002 (3000 a 3001 jsou obsazené)
- Caddy řeší HTTPS automaticky přes Let's Encrypt
- Statické soubory (uploads) servíruje Caddy přímo

### Next.js standalone + PM2

- `next.config.ts`: `output: 'standalone'`
- Aplikace v `/opt/hospodaracice/app/`
- PM2: `pm2 start .next/standalone/server.js --name hospodaracice -- -p 3002`

### Deploy proces

```bash
cd /opt/hospodaracice/app
git pull
npm ci
npm run build
pm2 restart hospodaracice
```

## Databáze (PostgreSQL 16)

### Přístup

- **Databáze:** `hospodaracice`
- **Uživatel:** `hospodaracice` (vlastní uživatel s přístupem jen na tuto DB)
- **Knihovna:** `pg` (node-postgres), žádný ORM
- **Migrace:** SQL skripty v `db/migrations/`

### Schéma

| Současný JSON | Tabulka | Sloupce |
|---|---|---|
| `reservations.json` | `reservations` | id, name, email, seats, date, time, status, token, created_at |
| `orders.json` | `orders` | id, day, items (jsonb), name, phone, address, village, created_at |
| `opening-hours.json` | `opening_hours` | id, day_of_week, open, close, closed (bool) |
| `delivery-villages.json` | `delivery_villages` | id, name |
| `weekly-menu.json` | `menu_items` | id, day, name, price, category |
| `gallery.json` | `gallery` | id, filename, alt_text, sort_order, media_type, created_at |
| `{type}.json` (OCR) | `menu_images` | id, type, alt_text, ocr_text |

## Souborový systém

### Struktura

```
/opt/hospodaracice/
  ├── app/                    # git repo + build
  │   ├── .next/standalone/   # standalone server
  │   ├── .next/static/       # statické assety
  │   ├── db/migrations/      # SQL migrace
  │   ├── scripts/            # deploy a migrační skripty
  │   └── .env                # environment variables
  └── uploads/                # mimo repo
      ├── menu/               # action.webp, weekly.webp, permanent1-4.webp
      └── gallery/            # gallery-{id}.webp, gallery-{id}.mp4
```

### Změny v kódu

- `@vercel/blob.put()` → `fs.writeFile()`
- `@vercel/blob.del()` → `fs.unlink()`
- `@vercel/blob.head()` → `fs.stat()` / `fs.access()`
- `NEXT_PUBLIC_BLOB_BASE_URL` → `NEXT_PUBLIC_UPLOADS_URL` (`https://hospodaracice.cz/uploads`)

## Environment variables

```
DATABASE_URL=postgresql://hospodaracice:***@localhost:5432/hospodaracice
ADMIN_SECRET=...
RESEND_API_KEY=...
ANTHROPIC_API_KEY=...
ORDER_EMAIL=...
NEXT_PUBLIC_BASE_URL=https://hospodaracice.cz
NEXT_PUBLIC_UPLOADS_URL=https://hospodaracice.cz/uploads
TOTAL_SEATS=40
```

## Externí služby (beze změny)

- **Resend** — odesílání emailů (rezervace, objednávky)
- **Anthropic API** — Claude Vision pro OCR extrakci textu z menu obrázků

## Migrace dat

Jednorázový migrační skript (`scripts/migrate-from-vercel.ts`):

1. Stáhnout obrázky z Vercel Blob do `/opt/hospodaracice/uploads/`
2. Stáhnout JSON data z Blobu a naimportovat do PostgreSQL
3. Stáhnout OCR JSON soubory a naimportovat do tabulky `menu_images`

## Soubory k úpravě

| Soubor | Změna |
|---|---|
| `next.config.ts` | Přidat `output: 'standalone'`, změnit `remotePatterns` |
| `package.json` | Nahradit `@vercel/blob` za `pg` |
| `src/app/api/upload/route.ts` | Blob → fs.writeFile |
| `src/app/api/delete/route.ts` | Blob → fs.unlink |
| `src/app/api/gallery/route.ts` | Blob → fs + PostgreSQL |
| `src/app/api/opening-hours/route.ts` | Blob → PostgreSQL |
| `src/app/api/menu/route.ts` | Blob → PostgreSQL |
| `src/app/api/delivery-villages/route.ts` | Blob → PostgreSQL |
| `src/app/api/orders/route.ts` | Blob → PostgreSQL |
| `src/app/api/reservations/*.ts` | Blob → PostgreSQL |
| `src/app/lib/reservations.ts` | Blob → PostgreSQL |
| `src/app/lib/orders.ts` | Blob → PostgreSQL |
| `src/app/page.tsx` | Změna URL pro obrázky |
| `src/app/admin/page.tsx` | Změna URL pro obrázky |
| `src/app/robots.ts` | Aktualizace URL |
| `src/app/sitemap.ts` | Aktualizace URL |
