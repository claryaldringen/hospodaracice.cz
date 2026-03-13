import Footer from '@/app/components/Footer';
import Navigation from '@/app/components/Navigation';
import MenuImages from '@/app/components/MenuImages';
import { IMAGE_TYPES, type ImageOcrData } from '@/app/types';

export const revalidate = 60;

const baseUrl = process.env.NEXT_PUBLIC_BLOB_BASE_URL;

async function checkImageExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', next: { revalidate: 60 } });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchOcrData(type: string): Promise<ImageOcrData | undefined> {
  try {
    const res = await fetch(`${baseUrl}/${type}.json`, { next: { revalidate: 60 } });
    if (res.ok) return await res.json();
  } catch {
    // JSON may not exist
  }
  return undefined;
}

export default async function HomePage() {
  const resolved = await Promise.all(
    IMAGE_TYPES.map(async (type) => {
      const [imageUrl, ocrData] = await Promise.all([
        (async () => {
          const webpUrl = `${baseUrl}/${type}.webp`;
          if (await checkImageExists(webpUrl)) return webpUrl;
          const jpgUrl = `${baseUrl}/${type}.jpg`;
          if (await checkImageExists(jpgUrl)) return jpgUrl;
          return null;
        })(),
        fetchOcrData(type),
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
        <Footer />
      </main>
    </div>
  );
}
