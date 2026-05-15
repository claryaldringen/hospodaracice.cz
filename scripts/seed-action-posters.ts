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
  try {
    const menuDir = path.join(UPLOADS_DIR, 'menu');
    const legacyPath = path.join(menuDir, 'action.webp');
    const targetPath = path.join(menuDir, 'action-1.webp');

    if (existsSync(targetPath)) {
      console.log('action-1.webp already exists — nothing to seed.');
    } else if (existsSync(legacyPath)) {
      // Non-atomic: rename happens before INSERT. If INSERT fails, the file is
      // renamed but no DB row exists; manual cleanup (rename back) required.
      renameSync(legacyPath, targetPath);
      console.log(`Renamed ${legacyPath} → ${targetPath}`);
      await pool.query(
        `INSERT INTO action_posters (filename, position, alt_text)
         SELECT 'action-1.webp', 1, 'Plakát akce'
         WHERE NOT EXISTS (SELECT 1 FROM action_posters WHERE filename = 'action-1.webp')`
      );
      console.log('Inserted action_posters row for legacy action.webp.');
    } else {
      console.log('No legacy action.webp found — nothing to seed.');
    }

    await pool.query("DELETE FROM menu_images WHERE type = 'action'");
    console.log("Cleared legacy menu_images row for type='action'.");
  } finally {
    await pool.end();
  }
  console.log('Seed complete.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
