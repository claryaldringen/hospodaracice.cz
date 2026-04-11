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
  return (
    <>
      {visibleSections.action && availableImages.action && (
        <section id="action">
          <div className="relative w-full h-screen mt-4 mb-4 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={availableImages.action}
              alt={ocrData.action?.altText || 'Akce Letáček'}
              className="max-h-full max-w-full object-contain shadow-lg"
              loading="eager"
            />
          </div>
          {ocrData.action?.fullText && <div className="sr-only">{ocrData.action.fullText}</div>}
        </section>
      )}

      {visibleSections.weekly && availableImages.weekly && (
        <section id="weekly">
          <div className="mt-4 mb-4 flex flex-col md:flex-row">
            <div className="relative w-full md:w-1/2 h-screen flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={availableImages.weekly}
                alt={ocrData.weekly?.altText || 'Týdenní Nabídka'}
                className="max-h-full max-w-full object-contain shadow-lg"
                loading="eager"
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
