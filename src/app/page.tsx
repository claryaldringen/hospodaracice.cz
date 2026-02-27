import Footer from '@/app/components/Footer';
import Navigation from '@/app/components/Navigation';
import MenuImages from '@/app/components/MenuImages';
import { IMAGE_TYPES } from '@/app/types';

export const dynamic = 'force-dynamic';

const baseUrl = process.env.NEXT_PUBLIC_BLOB_BASE_URL;

async function checkImageExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', next: { revalidate: 60 } });
    return res.ok;
  } catch {
    return false;
  }
}

export default async function HomePage() {
  const resolved = await Promise.all(
    IMAGE_TYPES.map(async (type) => {
      const webpUrl = `${baseUrl}/${type}.webp`;
      if (await checkImageExists(webpUrl)) return [type, webpUrl] as const;
      const jpgUrl = `${baseUrl}/${type}.jpg`;
      if (await checkImageExists(jpgUrl)) return [type, jpgUrl] as const;
      return [type, null] as const;
    })
  );

  const availableImages: Record<string, string> = {};
  const availability: Record<string, boolean> = {};
  for (const [type, url] of resolved) {
    availability[type] = url !== null;
    if (url) availableImages[type] = url;
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
        <MenuImages availableImages={availableImages} visibleSections={visibleSections} />
        <Footer />
      </main>
    </div>
  );
}
