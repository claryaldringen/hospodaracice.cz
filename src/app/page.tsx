'use client';

import { useEffect, useState } from 'react';
import NextImage from 'next/image';
import Footer from '@/app/components/Footer';
import Navigation from '@/app/components/Navigation';

const baseUrl = process.env.NEXT_PUBLIC_BLOB_BASE_URL;

const imageTypes = [
  'action',
  'weekly',
  'permanent1',
  'permanent2',
  'permanent3',
  'permanent4',
] as const;
type ImageType = (typeof imageTypes)[number];

export default function HomePage() {
  const [images, setImages] = useState<Record<ImageType, string>>(
    imageTypes.reduce(
      (acc, type) => {
        acc[type] = `${baseUrl}/${type}.jpg`;
        return acc;
      },
      {} as Record<ImageType, string>
    )
  );
  const [imageSizes, setImageSizes] = useState<{
    [key: string]: { width: number; height: number };
  }>({});

  const fetchImageSize = (url: string, key: string) => {
    const img = document.createElement('img');
    img.onload = () => {
      setImageSizes((prev) => ({
        ...prev,
        [key]: { width: img.naturalWidth, height: img.naturalHeight },
      }));
    };
    img.src = url;
  };

  const isImageAccessible = async (url: string) => {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  };

  const [visibleImages, setVisibleImages] = useState({
    action: false,
    weekly: false,
    permanent: false,
  });

  useEffect(() => {
    const checkImages = async () => {
      const actionVisible = images.action ? await isImageAccessible(images.action) : false;
      const weeklyVisible = images.weekly ? await isImageAccessible(images.weekly) : false;
      const permanentVisible = images.permanent1
        ? await isImageAccessible(images.permanent1)
        : false;

      setVisibleImages({
        action: actionVisible,
        weekly: weeklyVisible,
        permanent: permanentVisible,
      });

      if (actionVisible && images.action) fetchImageSize(images.action, 'action');
      if (weeklyVisible && images.weekly) fetchImageSize(images.weekly, 'weekly');
      if (permanentVisible && images.permanent1) fetchImageSize(images.permanent1, 'permanent');
    };
    checkImages();
  }, [images]);

  console.log(visibleImages);

  return (
    <div>
      <Navigation visibleImages={visibleImages} />
      <main className="pt-12 bg-black">
        {visibleImages.action && imageSizes.action && (
          <section id="action">
            <div className="relative w-full h-screen mt-4 mb-4">
              <NextImage
                src={images.action!}
                alt="Akce Letáček"
                layout="fill"
                objectFit="contain"
                className="shadow-lg"
              />
            </div>
          </section>
        )}

        {visibleImages.weekly && imageSizes.weekly && (
          <section id="weekly">
            <div className="relative w-full h-screen mt-4 mb-4">
              <NextImage
                src={images.weekly!}
                alt="Týdenní Nabídka"
                layout="fill"
                objectFit="contain"
                className="shadow-lg"
              />
            </div>
          </section>
        )}

        {visibleImages.permanent && (
          <section id="permanent" className="grid grid-cols-1 md:grid-cols-2">
            {[images.permanent1, images.permanent2, images.permanent3, images.permanent4].map(
              (url, index) =>
                url && (
                  <div
                    key={index}
                    className={`relative w-full h-screen flex ${
                      index % 2 === 0 ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <NextImage
                      src={url}
                      width={imageSizes.permanent?.width || 0}
                      height={imageSizes.permanent?.height || 0}
                      alt={`Stálá Nabídka ${index + 1}`}
                      className="h-auto max-h-screen max-w-full object-contain"
                    />
                  </div>
                )
            )}
          </section>
        )}

        <Footer />
      </main>
    </div>
  );
}
