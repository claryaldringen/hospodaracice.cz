// scripts/migrate-data.ts
import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const BLOB_BASE = process.env.VERCEL_BLOB_BASE_URL;
const UPLOADS_DIR = process.env.UPLOADS_DIR || '/opt/hospodaracice/uploads';
const DATABASE_URL = process.env.DATABASE_URL;

if (!BLOB_BASE || !DATABASE_URL) {
  console.error('Set VERCEL_BLOB_BASE_URL and DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function fetchJson(filename: string): Promise<unknown | null> {
  try {
    const res = await fetch(`${BLOB_BASE}/${filename}`);
    if (res.ok) return await res.json();
  } catch {
    /* ignore */
  }
  return null;
}

async function downloadFile(filename: string, destDir: string): Promise<boolean> {
  try {
    const res = await fetch(`${BLOB_BASE}/${filename}`);
    if (!res.ok) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    mkdirSync(destDir, { recursive: true });
    writeFileSync(path.join(destDir, filename), buffer);
    console.log(`Downloaded: ${filename}`);
    return true;
  } catch {
    return false;
  }
}

async function migrate() {
  console.log('=== Migrating data from Vercel Blob ===');

  // 1. Opening hours
  const oh = (await fetchJson('opening-hours.json')) as { text?: string } | null;
  if (oh?.text) {
    await pool.query(
      'INSERT INTO opening_hours (id, text) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET text = $1',
      [oh.text]
    );
    console.log('Migrated: opening hours');
  }

  // 2. Delivery villages
  const dv = (await fetchJson('delivery-villages.json')) as { villages?: string[] } | null;
  if (dv?.villages) {
    for (const name of dv.villages) {
      await pool.query(
        'INSERT INTO delivery_villages (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
        [name]
      );
    }
    console.log(`Migrated: ${dv.villages.length} delivery villages`);
  }

  // 3. Weekly menu
  const menu = await fetchJson('weekly-menu.json');
  if (menu) {
    await pool.query(
      'INSERT INTO weekly_menu (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = $1',
      [JSON.stringify(menu)]
    );
    console.log('Migrated: weekly menu');
  }

  // 4. OCR data for menu images
  const imageTypes = ['action', 'weekly', 'permanent1', 'permanent2', 'permanent3', 'permanent4'];
  for (const type of imageTypes) {
    const ocr = (await fetchJson(`${type}.json`)) as {
      fullText?: string;
      altText?: string;
    } | null;
    if (ocr?.fullText) {
      await pool.query(
        `INSERT INTO menu_images (type, full_text, alt_text) VALUES ($1, $2, $3)
         ON CONFLICT (type) DO UPDATE SET full_text = $2, alt_text = $3`,
        [type, ocr.fullText, ocr.altText || '']
      );
      console.log(`Migrated: OCR data for ${type}`);
    }
  }

  // 5. Reservations
  const reservations = (await fetchJson('reservations.json')) as
    | Array<{
        id: string;
        name: string;
        email: string;
        seats: number;
        date: string;
        timeFrom: string;
        timeTo: string;
        note?: string;
        status: string;
        token: string;
        createdAt: string;
      }>
    | null;
  if (reservations) {
    for (const r of reservations) {
      await pool.query(
        `INSERT INTO reservations (id, name, email, seats, date, time_from, time_to, note, status, token, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
        [
          r.id,
          r.name,
          r.email,
          r.seats,
          r.date,
          r.timeFrom,
          r.timeTo,
          r.note || null,
          r.status,
          r.token,
          r.createdAt,
        ]
      );
    }
    console.log(`Migrated: ${reservations.length} reservations`);
  }

  // 6. Orders
  const orders = (await fetchJson('orders.json')) as
    | Array<{
        id: string;
        name: string;
        phone: string;
        address: string;
        village: string;
        note?: string;
        day: string;
        date: string;
        items: unknown;
        createdAt: string;
      }>
    | null;
  if (orders) {
    for (const o of orders) {
      await pool.query(
        `INSERT INTO orders (id, name, phone, address, village, note, day, date, items, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
        [
          o.id,
          o.name,
          o.phone,
          o.address,
          o.village,
          o.note || null,
          o.day,
          o.date,
          JSON.stringify(o.items),
          o.createdAt,
        ]
      );
    }
    console.log(`Migrated: ${orders.length} orders`);
  }

  // 7. Gallery
  const gallery = (await fetchJson('gallery.json')) as
    | Array<{
        id: string;
        type: string;
        url: string;
        createdAt: string;
      }>
    | null;
  if (gallery) {
    const galleryDir = path.join(UPLOADS_DIR, 'gallery');
    mkdirSync(galleryDir, { recursive: true });
    for (const item of gallery) {
      const filename = item.url.split('/').pop()!;
      try {
        const res = await fetch(item.url);
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          writeFileSync(path.join(galleryDir, filename), buffer);
        }
      } catch {
        /* skip */
      }
      await pool.query(
        `INSERT INTO gallery (id, type, filename, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
        [item.id, item.type, filename, item.createdAt]
      );
    }
    console.log(`Migrated: ${gallery.length} gallery items`);
  }

  // 8. Menu images (files)
  const menuDir = path.join(UPLOADS_DIR, 'menu');
  mkdirSync(menuDir, { recursive: true });
  for (const type of imageTypes) {
    await downloadFile(`${type}.webp`, menuDir);
    await downloadFile(`${type}.jpg`, menuDir);
  }

  await pool.end();
  console.log('=== Migration complete ===');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
