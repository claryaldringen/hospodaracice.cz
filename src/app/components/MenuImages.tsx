import type { ActionPoster, ImageOcrData, WeeklyTabData } from '@/app/types';
import WeeklyMenuTabs from '@/app/components/WeeklyMenuTabs';
import ActionPosters from '@/app/components/ActionPosters';

interface MenuImagesProps {
  availableImages: Record<string, string>;
  visibleSections: {
    action: boolean;
    weekly: boolean;
    permanent: boolean;
  };
  ocrData: Record<string, ImageOcrData>;
  weeklyData: {
    current: WeeklyTabData | null;
    next: WeeklyTabData | null;
  };
  actionPosters: ActionPoster[];
}

export default function MenuImages({
  availableImages,
  visibleSections,
  ocrData,
  weeklyData,
  actionPosters,
}: MenuImagesProps) {
  return (
    <>
      {visibleSections.action && <ActionPosters posters={actionPosters} />}

      {visibleSections.weekly && (
        <section id="weekly">
          <WeeklyMenuTabs current={weeklyData.current} next={weeklyData.next} />
        </section>
      )}

      {(visibleSections.action || visibleSections.weekly) && (
        <p className="px-4 py-2 text-center text-sm text-gray-400">
          Informace o alergenech podáme na vyžádání — tel.{' '}
          <a href="tel:+420702181247" className="underline hover:text-white">
            702 181 247
          </a>
        </p>
      )}

      {visibleSections.permanent && (
        <section id="permanent" className="grid grid-cols-1 md:grid-cols-2">
          {['permanent1', 'permanent2', 'permanent3', 'permanent4'].map(
            (key, index) =>
              availableImages[key] && (
                <div
                  key={key}
                  className={`relative w-full h-screen flex ${
                    index % 2 === 0 ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={availableImages[key]}
                    alt={ocrData[key]?.altText || `Stálá Nabídka ${index + 1}`}
                    className="h-auto max-h-screen max-w-full object-contain"
                    loading="lazy"
                  />
                  {ocrData[key]?.fullText && <div className="sr-only">{ocrData[key].fullText}</div>}
                </div>
              )
          )}
        </section>
      )}
    </>
  );
}
