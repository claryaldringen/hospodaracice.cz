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
  const imageUrls = Object.fromEntries(
    IMAGE_TYPES.map((type) => [type, `${baseUrl}/${type}.jpg`])
  ) as Record<string, string>;

  const results = await Promise.all(
    IMAGE_TYPES.map(async (type) => [type, await checkImageExists(imageUrls[type])] as const)
  );

  const availability = Object.fromEntries(results) as Record<string, boolean>;

  const availableImages: Record<string, string> = {};
  for (const type of IMAGE_TYPES) {
    if (availability[type]) {
      availableImages[type] = imageUrls[type];
    }
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
