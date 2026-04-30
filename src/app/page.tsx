import Footer from '@/app/components/Footer';
import Navigation from '@/app/components/Navigation';
import MenuImages from '@/app/components/MenuImages';
import Gallery from '@/app/components/Gallery';
import { IMAGE_TYPES, type ImageOcrData } from '@/app/types';
import { queryOne } from '@/app/lib/db';
import { fileExists, getPublicUrl } from '@/app/lib/storage';
import { getCurrentWeekKey } from '@/app/lib/week';

export const dynamic = 'force-dynamic';

async function fetchOpeningHours(): Promise<string | undefined> {
  const row = await queryOne<{ text: string }>('SELECT text FROM opening_hours WHERE id = 1');
  return row?.text || undefined;
}

async function fetchOcrData(type: string): Promise<ImageOcrData | undefined> {
  const row = await queryOne<{ full_text: string; alt_text: string }>(
    'SELECT full_text, alt_text FROM menu_images WHERE type = $1',
    [type]
  );
  return row ? { fullText: row.full_text, altText: row.alt_text } : undefined;
}

async function fetchWeeklyOcrData(weekKey: string): Promise<ImageOcrData | undefined> {
  const row = await queryOne<{ full_text: string; alt_text: string }>(
    'SELECT full_text, alt_text FROM weekly_menu WHERE week_start = $1',
    [weekKey]
  );
  return row ? { fullText: row.full_text, altText: row.alt_text } : undefined;
}

async function resolveImage(type: string): Promise<string | null> {
  const ts = Date.now();

  if (type === 'weekly') {
    const weekKey = getCurrentWeekKey();
    const filename = `weekly-${weekKey}.webp`;
    if (await fileExists('menu', filename)) {
      return `${getPublicUrl('menu', filename)}?${ts}`;
    }
    return null;
  }

  if (await fileExists('menu', `${type}.webp`)) {
    return `${getPublicUrl('menu', `${type}.webp`)}?${ts}`;
  }
  if (await fileExists('menu', `${type}.jpg`)) {
    return `${getPublicUrl('menu', `${type}.jpg`)}?${ts}`;
  }
  return null;
}

export default async function HomePage() {
  const openingHours = await fetchOpeningHours();
  const currentWeekKey = getCurrentWeekKey();

  const resolved = await Promise.all(
    IMAGE_TYPES.map(async (type) => {
      const [imageUrl, ocrData] = await Promise.all([
        resolveImage(type),
        type === 'weekly' ? fetchWeeklyOcrData(currentWeekKey) : fetchOcrData(type),
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
        <Gallery />
        <Footer openingHours={openingHours} />
      </main>
    </div>
  );
}
