'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

const imageTypes = [
  'action',
  'weekly',
  'permanent1',
  'permanent2',
  'permanent3',
  'permanent4',
] as const;

type ImageType = (typeof imageTypes)[number];

const BLOB_BASE_URL = process.env.NEXT_PUBLIC_BLOB_BASE_URL;

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [images, setImages] = useState<Record<ImageType, string | null>>(
    Object.fromEntries(imageTypes.map((type) => [type, `${BLOB_BASE_URL}/${type}.jpg`])) as Record<
      ImageType,
      string | null
    >
  );
  const [existingImages, setExistingImages] = useState<Record<ImageType, boolean>>({
    action: false,
    weekly: false,
    permanent1: false,
    permanent2: false,
    permanent3: false,
    permanent4: false,
  });

  const fileInputRefs = useRef<Record<ImageType, HTMLInputElement | null>>({
    action: null,
    weekly: null,
    permanent1: null,
    permanent2: null,
    permanent3: null,
    permanent4: null,
  });

  const checkImageExists = async (url: string) => {
    try {
      const res = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
      return res.ok;
    } catch {
      return false;
    }
  };

  const checkImages = useCallback(async () => {
    const results = await Promise.all(
      (
        ['action', 'weekly', 'permanent1', 'permanent2', 'permanent3', 'permanent4'] as ImageType[]
      ).map(async (type) => {
        if (images[type]) {
          const exists = await checkImageExists(images[type]!);
          return [type, exists];
        }
        return [type, false];
      })
    );
    setExistingImages(Object.fromEntries(results) as Record<ImageType, boolean>);
  }, [images]);

  useEffect(() => {
    checkImages();
  }, [checkImages]);

  const handleLogin = () => {
    if (password === process.env.NEXT_PUBLIC_ADMIN_SECRET) {
      setIsAuthenticated(true);
    } else {
      alert('Nesprávné heslo!');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: ImageType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}`,
      },
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      setImages((prev) => ({ ...prev, [type]: `${data.url}?${new Date().getTime()}` }));
      setExistingImages((prev) => ({ ...prev, [type]: true }));
      alert('Soubor úspěšně nahrán!');
    } else {
      alert('Chyba při nahrávání souboru.');
    }
  };

  const handleDelete = async (type: ImageType) => {
    if (!images[type]) return;

    const res = await fetch('/api/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}`,
      },
      body: JSON.stringify({ url: images[type] }),
    });

    if (res.ok) {
      setImages((prev) => ({ ...prev, [type]: null }));
      setExistingImages((prev) => ({ ...prev, [type]: false }));
      alert(`Obrázek pro ${type} byl odstraněn!`);
    } else {
      alert('Chyba při mazání souboru.');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-screen">
        <input
          type="password"
          placeholder="Zadejte heslo"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyPress}
          className="border border-gray-300 p-2 rounded w-64 mb-4 shadow-sm"
        />
        <button
          onClick={handleLogin}
          className="bg-blue-500 text-white px-4 py-2 rounded shadow hover:bg-blue-600"
        >
          Přihlásit
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-center">Admin Panel - Nahrávání Obrázků</h1>
      <div className="space-y-4">
        {(
          [
            'action',
            'weekly',
            'permanent1',
            'permanent2',
            'permanent3',
            'permanent4',
          ] as ImageType[]
        ).map((type) => (
          <div
            key={type}
            className="flex flex-col md:flex-row items-center md:space-x-4 space-y-2 md:space-y-0"
          >
            {existingImages[type] && images[type] ? (
              <img
                src={images[type]!}
                alt={`${type} preview`}
                className="w-32 h-auto rounded shadow"
              />
            ) : (
              <div className="w-32 h-32 bg-gray-200 rounded shadow flex items-center justify-center">
                <span>Placeholder</span>
              </div>
            )}
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => fileInputRefs.current[type]?.click()}
                className="bg-blue-500 text-white px-3 py-1 rounded shadow hover:bg-blue-600"
              >
                {existingImages[type] ? 'Vybrat jiný obrázek' : 'Vybrat obrázek'}
              </button>
              <button
                onClick={() => handleDelete(type)}
                className="bg-red-500 text-white px-3 py-1 rounded shadow hover:bg-red-600"
              >
                Odstranit
              </button>
              <input
                type="file"
                onChange={(e) => handleUpload(e, type)}
                className="hidden"
                ref={(el) => {
                  fileInputRefs.current[type] = el;
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
