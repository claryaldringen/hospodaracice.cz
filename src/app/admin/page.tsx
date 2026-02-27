'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { IMAGE_TYPES, type ImageType } from '@/app/types';

const BLOB_BASE_URL = process.env.NEXT_PUBLIC_BLOB_BASE_URL;

const IMAGE_LABELS: Record<ImageType, string> = {
  action: 'Akce',
  weekly: 'Týdenní nabídka',
  permanent1: 'Stálá nabídka 1',
  permanent2: 'Stálá nabídka 2',
  permanent3: 'Stálá nabídka 3',
  permanent4: 'Stálá nabídka 4',
};

type StatusMessage = {
  type: 'success' | 'error';
  text: string;
} | null;

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);
  const [images, setImages] = useState<Record<ImageType, string | null>>(
    Object.fromEntries(IMAGE_TYPES.map((type) => [type, `${BLOB_BASE_URL}/${type}.jpg`])) as Record<
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

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3000);
  };

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
      IMAGE_TYPES.map(async (type) => {
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

  const handleLogin = async () => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setIsAuthenticated(true);
      } else {
        showStatus('error', 'Nesprávné heslo!');
      }
    } catch {
      showStatus('error', 'Chyba při přihlašování.');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
    setPassword('');
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: ImageType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      setImages((prev) => ({ ...prev, [type]: `${data.url}?${new Date().getTime()}` }));
      setExistingImages((prev) => ({ ...prev, [type]: true }));
      showStatus('success', 'Soubor úspěšně nahrán!');
    } else {
      showStatus('error', 'Chyba při nahrávání souboru.');
    }
  };

  const handleDelete = async (type: ImageType) => {
    if (!images[type]) return;

    const res = await fetch('/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: images[type] }),
    });

    if (res.ok) {
      setImages((prev) => ({ ...prev, [type]: null }));
      setExistingImages((prev) => ({ ...prev, [type]: false }));
      showStatus('success', `Obrázek „${IMAGE_LABELS[type]}" byl odstraněn!`);
    } else {
      showStatus('error', 'Chyba při mazání souboru.');
    }
  };

  // --- Login screen ---
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-2xl text-white">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-7 w-7"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Hospoda Na Palouku</h1>
            <p className="mt-1 text-sm text-gray-500">Administrace</p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z"
                  />
                </svg>
              </span>
              <input
                type="password"
                placeholder="Zadejte heslo"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyPress}
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <button
              onClick={handleLogin}
              className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white shadow transition hover:bg-gray-800 active:bg-gray-950"
            >
              Přihlásit se
            </button>
          </div>

          {statusMessage && (
            <div
              className={`mt-4 rounded-lg px-4 py-2.5 text-center text-sm font-medium ${
                statusMessage.type === 'success'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {statusMessage.text}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Dashboard ---
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gray-900 text-white shadow">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <h1 className="text-lg font-semibold">Admin Panel</h1>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-white/20 px-4 py-1.5 text-sm transition hover:bg-white/10"
          >
            Odhlásit se
          </button>
        </div>
      </header>

      {/* Status banner */}
      {statusMessage && (
        <div
          className={`px-4 py-3 text-center text-sm font-medium ${statusMessage.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {IMAGE_TYPES.map((type) => (
            <div key={type} className="overflow-hidden rounded-2xl bg-white shadow">
              {/* Card header */}
              <div className="border-b border-gray-100 px-5 py-3">
                <h2 className="font-semibold text-gray-900">{IMAGE_LABELS[type]}</h2>
              </div>

              {/* Image preview */}
              <div className="px-5 pt-4">
                {existingImages[type] && images[type] ? (
                  <img
                    src={images[type]!}
                    alt={IMAGE_LABELS[type]}
                    className="h-48 w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-48 w-full items-center justify-center rounded-lg bg-gray-100">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1}
                      stroke="currentColor"
                      className="h-12 w-12 text-gray-300"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
                      />
                    </svg>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 px-5 py-4">
                <button
                  onClick={() => fileInputRefs.current[type]?.click()}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 active:bg-blue-800"
                >
                  {existingImages[type] ? 'Změnit' : 'Nahrát'}
                </button>
                <button
                  onClick={() => handleDelete(type)}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 active:bg-red-100"
                >
                  Odstranit
                </button>
                <input
                  type="file"
                  accept="image/*"
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
      </main>
    </div>
  );
}
