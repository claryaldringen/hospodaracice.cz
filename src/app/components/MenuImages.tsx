import NextImage from 'next/image';

interface MenuImagesProps {
  availableImages: Record<string, string>;
  visibleSections: {
    action: boolean;
    weekly: boolean;
    permanent: boolean;
  };
}

export default function MenuImages({ availableImages, visibleSections }: MenuImagesProps) {
  return (
    <>
      {visibleSections.action && availableImages.action && (
        <section id="action">
          <div className="relative w-full h-screen mt-4 mb-4">
            <NextImage
              src={availableImages.action}
              alt="Akce Letáček"
              fill
              style={{ objectFit: 'contain' }}
              className="shadow-lg"
            />
          </div>
        </section>
      )}

      {visibleSections.weekly && availableImages.weekly && (
        <section id="weekly">
          <div className="relative w-full h-screen mt-4 mb-4">
            <NextImage
              src={availableImages.weekly}
              alt="Týdenní Nabídka"
              fill
              style={{ objectFit: 'contain' }}
              className="shadow-lg"
            />
          </div>
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
                    alt={`Stálá Nabídka ${index + 1}`}
                    className="h-auto max-h-screen max-w-full object-contain"
                  />
                </div>
              )
          )}
        </section>
      )}
    </>
  );
}
