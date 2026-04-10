'use client';

import { useState, useEffect, useCallback } from 'react';
import type { GalleryItem } from '@/app/types';

export default function Gallery() {
  const [items, setItems] = useState<GalleryItem[]>([]);

  const loadGallery = useCallback(async () => {
    try {
      const res = await fetch('/api/gallery');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadGallery();
  }, [loadGallery]);

  if (items.length === 0) return null;

  return (
    <section id="gallery" className="px-4 py-12">
      <h2 className="mb-8 text-center text-2xl font-bold text-white">Galerie</h2>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {items.map((item) => (
          <div key={item.id} className="overflow-hidden rounded-xl">
            {item.type === 'video' ? (
              <video src={item.url} controls className="h-64 w-full object-cover" />
            ) : (
              <img src={item.url} alt="" className="h-64 w-full object-cover" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
