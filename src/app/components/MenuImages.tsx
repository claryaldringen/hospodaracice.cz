import NextImage from 'next/image';
import type { ImageOcrData } from '@/app/types';
import OrderForm from '@/app/components/OrderForm';

interface MenuImagesProps {
  availableImages: Record<string, string>;
  visibleSections: {
    action: boolean;
    weekly: boolean;
    permanent: boolean;
  };
  ocrData: Record<string, ImageOcrData>;
}

export default function MenuImages({ availableImages, visibleSections, ocrData }: MenuImagesProps) {
  const firstVisibleSection = visibleSections.action
    ? 'action'
    : visibleSections.weekly
      ? 'weekly'
      : null;

  return (
    <>
      {visibleSections.action && availableImages.action && (
        <section id="action">
          <div className="relative w-full h-screen mt-4 mb-4">
            <NextImage
              src={availableImages.action}
              alt={ocrData.action?.altText || 'Akce Letáček'}
              fill
              sizes="100vw"
              priority={firstVisibleSection === 'action'}
              style={{ objectFit: 'contain' }}
              className="shadow-lg"
            />
          </div>
          {ocrData.action?.fullText && <div className="sr-only">{ocrData.action.fullText}</div>}
        </section>
      )}

      {visibleSections.weekly && availableImages.weekly && (
        <section id="weekly">
          <div className="mt-4 mb-4 flex flex-col md:flex-row">
            <div className="relative w-full md:w-1/2 h-screen">
              <NextImage
                src={availableImages.weekly}
                alt={ocrData.weekly?.altText || 'Týdenní Nabídka'}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                priority={firstVisibleSection === 'weekly'}
                style={{ objectFit: 'contain' }}
                className="shadow-lg"
              />
            </div>
            <div className="w-full md:w-1/2 flex items-start justify-center py-8">
              <div className="w-full max-w-md">
                <OrderForm />
              </div>
            </div>
          </div>
          {ocrData.weekly?.fullText && <div className="sr-only">{ocrData.weekly.fullText}</div>}
        </section>
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
                  <NextImage
                    src={availableImages[key]}
                    width={800}
                    height={1200}
                    sizes="(max-width: 768px) 100vw, 50vw"
                    alt={ocrData[key]?.altText || `Stálá Nabídka ${index + 1}`}
                    className="h-auto max-h-screen max-w-full object-contain"
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
