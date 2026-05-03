import Footer from '@/app/components/Footer';
import Navigation from '@/app/components/Navigation';
import MenuImages from '@/app/components/MenuImages';
import Gallery from '@/app/components/Gallery';
import { IMAGE_TYPES, type ImageOcrData, type WeeklyMenu, type WeeklyTabData } from '@/app/types';
import { query, queryOne } from '@/app/lib/db';
import { fileExists, getPublicUrl } from '@/app/lib/storage';
import { formatWeekKey, formatWeekRange, getMonday, parseWeekKey } from '@/app/lib/week';

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

async function fetchWeeklyTabsData(
  currentKey: string,
  nextKey: string
): Promise<{ current: WeeklyTabData | null; next: WeeklyTabData | null }> {
  const rows = await query<{
    week_start: string;
    data: WeeklyMenu | null;
    full_text: string | null;
    alt_text: string | null;
  }>(
    `SELECT TO_CHAR(week_start, 'YYYY-MM-DD') AS week_start, data, full_text, alt_text
     FROM weekly_menu WHERE week_start IN ($1, $2)`,
    [currentKey, nextKey]
  );

  const ts = Date.now();
  const byKey = new Map<string, WeeklyTabData>();

  for (const row of rows) {
    const weekKey = row.week_start;
    const weekRange = formatWeekRange(parseWeekKey(weekKey));
    const ocrData =
      row.full_text && row.alt_text
        ? { fullText: row.full_text, altText: row.alt_text }
        : undefined;
    byKey.set(weekKey, {
      weekKey,
      weekRange,
      imageUrl: `${getPublicUrl('menu', `weekly-${weekKey}.webp`)}?${ts}`,
      ocrData,
      days: row.data?.days ?? [],
    });
  }

  return {
    current: byKey.get(currentKey) ?? null,
    next: byKey.get(nextKey) ?? null,
  };
}

async function resolveImage(type: string): Promise<string | null> {
  const ts = Date.now();

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

  const currentMonday = getMonday(new Date());
  const nextMonday = new Date(currentMonday);
  nextMonday.setDate(nextMonday.getDate() + 7);
  const currentWeekKey = formatWeekKey(currentMonday);
  const nextWeekKey = formatWeekKey(nextMonday);

  const nonWeeklyTypes = IMAGE_TYPES.filter((t) => t !== 'weekly');

  const [weeklyData, resolved] = await Promise.all([
    fetchWeeklyTabsData(currentWeekKey, nextWeekKey),
    Promise.all(
      nonWeeklyTypes.map(async (type) => {
        const [imageUrl, ocrData] = await Promise.all([resolveImage(type), fetchOcrData(type)]);
        return [type, imageUrl, ocrData] as const;
      })
    ),
  ]);

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
    weekly: !!(weeklyData.current || weeklyData.next),
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
          weeklyData={weeklyData}
        />
        <Gallery />
        <Footer openingHours={openingHours} />
      </main>
    </div>
  );
}
