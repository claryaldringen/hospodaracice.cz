'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  IMAGE_TYPES,
  type ImageType,
  type Reservation,
  type GalleryItem,
  type Order,
} from '@/app/types';

const UPLOADS_URL = process.env.NEXT_PUBLIC_UPLOADS_URL;

const MAX_WIDTH = 1920;
const WEBP_QUALITY = 0.85;

function processImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_WIDTH) {
        height = Math.round(height * (MAX_WIDTH / width));
        width = MAX_WIDTH;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed'));
        },
        'image/webp',
        WEBP_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

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
  const [showPassword, setShowPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);
  const [openingHours, setOpeningHours] = useState('');
  const [savedOpeningHours, setSavedOpeningHours] = useState('');
  const [reservationDate, setReservationDate] = useState(new Date().toISOString().slice(0, 10));
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [villages, setVillages] = useState('');
  const [savedVillages, setSavedVillages] = useState('');
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderView, setOrderView] = useState<'summary' | 'village'>('summary');
  const [images, setImages] = useState<Record<ImageType, string | null>>(
    Object.fromEntries(IMAGE_TYPES.map((type) => [type, null])) as Record<ImageType, string | null>
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

  const resolveImages = useCallback(async () => {
    const ts = Date.now();
    const results = await Promise.all(
      IMAGE_TYPES.map(async (type) => {
        const webpUrl = `${UPLOADS_URL}/menu/${type}.webp`;
        if (await checkImageExists(webpUrl)) return [type, `${webpUrl}?${ts}`] as const;
        const jpgUrl = `${UPLOADS_URL}/menu/${type}.jpg`;
        if (await checkImageExists(jpgUrl)) return [type, `${jpgUrl}?${ts}`] as const;
        return [type, null] as const;
      })
    );
    const newImages: Record<string, string | null> = {};
    const newExists: Record<string, boolean> = {};
    for (const [type, url] of results) {
      newImages[type] = url;
      newExists[type] = url !== null;
    }
    setImages(newImages as Record<ImageType, string | null>);
    setExistingImages(newExists as Record<ImageType, boolean>);
  }, []);

  const loadOpeningHours = useCallback(async () => {
    try {
      const res = await fetch('/api/opening-hours');
      if (res.ok) {
        const data = await res.json();
        setOpeningHours(data.text || '');
        setSavedOpeningHours(data.text || '');
      }
    } catch {
      // ignore
    }
  }, []);

  const loadVillages = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery-villages');
      if (res.ok) {
        const data = await res.json();
        const text = (data.villages || []).join('\n');
        setVillages(text);
        setSavedVillages(text);
      }
    } catch {
      // ignore
    }
  }, []);

  const loadGallery = useCallback(async () => {
    try {
      const res = await fetch('/api/gallery');
      if (res.ok) {
        const data = await res.json();
        setGalleryItems(data.items || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    resolveImages();
    loadOpeningHours();
    loadVillages();
    loadGallery();
  }, [resolveImages, loadOpeningHours, loadVillages, loadGallery]);

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
    e.target.value = '';

    let processed: Blob;
    try {
      processed = await processImage(file);
    } catch {
      showStatus('error', 'Chyba při zpracování obrázku.');
      return;
    }

    // Show local preview immediately
    const previewUrl = URL.createObjectURL(processed);
    setImages((prev) => ({ ...prev, [type]: previewUrl }));
    setExistingImages((prev) => ({ ...prev, [type]: true }));

    const formData = new FormData();
    formData.append('file', processed, `${type}.webp`);
    formData.append('type', type);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      URL.revokeObjectURL(previewUrl);
      setImages((prev) => ({ ...prev, [type]: `${data.url}?${new Date().getTime()}` }));
      showStatus('success', 'Soubor úspěšně nahrán!');
    } else {
      URL.revokeObjectURL(previewUrl);
      showStatus('error', 'Chyba při nahrávání souboru.');
    }
  };

  const loadReservations = useCallback(async (d: string) => {
    try {
      const res = await fetch(`/api/reservations/list?date=${d}`);
      if (res.ok) {
        const data = await res.json();
        setReservations(data.reservations || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadReservations(reservationDate);
  }, [isAuthenticated, reservationDate, loadReservations]);

  const loadOrders = useCallback(async (d: string) => {
    try {
      const res = await fetch(`/api/orders/list?date=${d}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadOrders(orderDate);
  }, [isAuthenticated, orderDate, loadOrders]);

  const handleCancelReservation = async (id: string) => {
    const res = await fetch('/api/reservations/admin-cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      showStatus('success', 'Rezervace zrušena.');
      loadReservations(reservationDate);
    } else {
      showStatus('error', 'Chyba při rušení rezervace.');
    }
  };

  const handleSaveOpeningHours = async () => {
    try {
      const res = await fetch('/api/opening-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: openingHours }),
      });
      if (res.ok) {
        setSavedOpeningHours(openingHours);
        showStatus('success', 'Otevírací doba uložena!');
      } else {
        showStatus('error', 'Chyba při ukládání otevírací doby.');
      }
    } catch {
      showStatus('error', 'Chyba při ukládání otevírací doby.');
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setGalleryUploading(true);

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        await fetch('/api/gallery', { method: 'POST', body: formData });
      } catch {
        // ignore individual failures
      }
    }

    setGalleryUploading(false);
    loadGallery();
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    showStatus('success', 'Soubory nahrány do galerie!');
  };

  const handleGalleryDelete = async (id: string) => {
    const res = await fetch('/api/gallery', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      loadGallery();
      showStatus('success', 'Položka odstraněna z galerie.');
    } else {
      showStatus('error', 'Chyba při mazání položky.');
    }
  };

  const handleSaveVillages = async () => {
    try {
      const res = await fetch('/api/delivery-villages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ villages }),
      });
      if (res.ok) {
        setSavedVillages(villages);
        showStatus('success', 'Seznam obcí uložen!');
      } else {
        showStatus('error', 'Chyba při ukládání obcí.');
      }
    } catch {
      showStatus('error', 'Chyba při ukládání obcí.');
    }
  };

  const handleDelete = async (type: ImageType) => {
    if (!images[type]) return;

    // Strip cache-busting query parameter before sending to delete API
    const cleanUrl = images[type]!.split('?')[0];

    const res = await fetch('/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });

    if (res.ok) {
      setImages((prev) => ({ ...prev, [type]: null }));
      setExistingImages((prev) => ({ ...prev, [type]: false }));
      showStatus('success', `Obrázek „${IMAGE_LABELS[type]}" byl odstraněn!`);
    } else {
      showStatus('error', 'Chyba při mazání souboru.');
    }
  };

  // Summary view: aggregate items across all orders
  const orderSummary = orders.reduce<
    Record<string, { name: string; quantity: number; totalPrice: number }>
  >((acc, order) => {
    for (const item of order.items) {
      const key = item.name;
      if (!acc[key]) {
        acc[key] = { name: item.name, quantity: 0, totalPrice: 0 };
      }
      acc[key].quantity += item.quantity;
      acc[key].totalPrice += item.price * item.quantity;
    }
    return acc;
  }, {});
  const summaryRows = Object.values(orderSummary);
  const summaryTotal = summaryRows.reduce((sum, r) => sum + r.totalPrice, 0);

  // Village view: group items by village
  const ordersByVillage = orders.reduce<Record<string, { name: string; quantity: number }[]>>(
    (acc, order) => {
      if (!acc[order.village]) acc[order.village] = [];
      for (const item of order.items) {
        const existing = acc[order.village].find((r) => r.name === item.name);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          acc[order.village].push({ name: item.name, quantity: item.quantity });
        }
      }
      return acc;
    },
    {}
  );

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
                type={showPassword ? 'text' : 'password'}
                placeholder="Zadejte heslo"
                aria-label="Heslo"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyPress}
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-10 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Skrýt heslo' : 'Zobrazit heslo'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
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
                      d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                    />
                  </svg>
                ) : (
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
                      d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                    />
                  </svg>
                )}
              </button>
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
              <div className="relative px-5 pt-4">
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

        {/* Opening hours */}
        <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow">
          <div className="border-b border-gray-100 px-5 py-3">
            <h2 className="font-semibold text-gray-900">Otevírací doba</h2>
          </div>
          <div className="px-5 py-4">
            <textarea
              value={openingHours}
              onChange={(e) => setOpeningHours(e.target.value)}
              rows={7}
              placeholder={
                'Pondělí: ZAVŘENO\nÚterý: 11:00 – 15:00\nStředa: 11:00 – 15:00\nČtvrtek: 11:00 – 15:00\nPátek: 11:00 – 23:00\nSobota: 11:00 – 23:00\nNeděle: 11:00 – 19:00'
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              onClick={handleSaveOpeningHours}
              disabled={openingHours === savedOpeningHours}
              className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Uložit
            </button>
          </div>
        </div>

        {/* Gallery */}
        <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h2 className="font-semibold text-gray-900">Galerie</h2>
            <button
              onClick={() => galleryInputRef.current?.click()}
              disabled={galleryUploading}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
            >
              {galleryUploading ? 'Nahrávání…' : 'Přidat'}
            </button>
            <input
              type="file"
              accept="image/*,video/mp4"
              multiple
              onChange={handleGalleryUpload}
              className="hidden"
              ref={galleryInputRef}
            />
          </div>
          <div className="px-5 py-4">
            {galleryItems.length === 0 ? (
              <p className="text-sm text-gray-500">Galerie je prázdná.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {galleryItems.map((item) => (
                  <div key={item.id} className="group relative">
                    {item.type === 'video' ? (
                      <video src={item.url} className="h-32 w-full rounded-lg object-cover" muted />
                    ) : (
                      <img src={item.url} alt="" className="h-32 w-full rounded-lg object-cover" />
                    )}
                    <button
                      onClick={() => handleGalleryDelete(item.id)}
                      className="absolute right-1 top-1 hidden rounded-full bg-red-600 p-1 text-white shadow group-hover:block"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="h-4 w-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18 18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                    {item.type === 'video' && (
                      <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
                        Video
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Delivery villages */}
        <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow">
          <div className="border-b border-gray-100 px-5 py-3">
            <h2 className="font-semibold text-gray-900">Rozvoz — obce</h2>
          </div>
          <div className="px-5 py-4">
            <textarea
              value={villages}
              onChange={(e) => setVillages(e.target.value)}
              rows={4}
              placeholder={'Račice\nZbečno\nKřivoklát'}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              onClick={handleSaveVillages}
              disabled={villages === savedVillages}
              className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Uložit
            </button>
          </div>
        </div>

        {/* Reservations */}
        <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h2 className="font-semibold text-gray-900">Rezervace</h2>
            <input
              type="date"
              value={reservationDate}
              onChange={(e) => setReservationDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="px-5 py-4">
            {reservations.length === 0 ? (
              <p className="text-sm text-gray-500">Žádné rezervace na tento den.</p>
            ) : (
              <div className="space-y-3">
                {reservations.map((r) => (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between rounded-lg border p-3 ${
                      r.status === 'cancelled'
                        ? 'border-gray-200 bg-gray-50 opacity-60'
                        : r.status === 'pending'
                          ? 'border-yellow-200 bg-yellow-50'
                          : 'border-green-200 bg-green-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{r.name}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.status === 'confirmed'
                              ? 'bg-green-200 text-green-800'
                              : r.status === 'pending'
                                ? 'bg-yellow-200 text-yellow-800'
                                : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {r.status === 'confirmed'
                            ? 'Potvrzeno'
                            : r.status === 'pending'
                              ? 'Čeká na potvrzení'
                              : 'Zrušeno'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-gray-600">
                        {r.timeFrom} – {r.timeTo} · {r.seats}{' '}
                        {r.seats === 1 ? 'místo' : r.seats < 5 ? 'místa' : 'míst'} · {r.email}
                      </p>
                      {r.note && <p className="mt-0.5 text-xs text-gray-500">{r.note}</p>}
                    </div>
                    {r.status !== 'cancelled' && (
                      <button
                        onClick={() => handleCancelReservation(r.id)}
                        className="ml-3 shrink-0 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                      >
                        Zrušit
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Orders */}
        <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h2 className="font-semibold text-gray-900">Objednávky</h2>
            <input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* View toggle */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setOrderView('summary')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition ${
                orderView === 'summary'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Souhrn
            </button>
            <button
              onClick={() => setOrderView('village')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition ${
                orderView === 'village'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Podle obcí
            </button>
          </div>

          <div className="px-5 py-4">
            {orders.length === 0 ? (
              <p className="text-sm text-gray-500">Žádné objednávky na tento den.</p>
            ) : orderView === 'summary' ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="pb-2 font-medium">Jídlo</th>
                    <th className="pb-2 text-center font-medium">Počet</th>
                    <th className="pb-2 text-right font-medium">Cena</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((row) => (
                    <tr key={row.name} className="border-b border-gray-100">
                      <td className="py-2 text-gray-900">{row.name}</td>
                      <td className="py-2 text-center text-gray-600">{row.quantity}x</td>
                      <td className="py-2 text-right text-gray-600">{row.totalPrice} Kč</td>
                    </tr>
                  ))}
                  <tr className="font-medium">
                    <td className="pt-2 text-gray-900" colSpan={2}>
                      Celkem
                    </td>
                    <td className="pt-2 text-right text-gray-900">{summaryTotal} Kč</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <div className="space-y-4">
                {Object.entries(ordersByVillage)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([villageName, items]) => (
                    <div key={villageName}>
                      <h3 className="mb-1 text-sm font-semibold text-gray-900">{villageName}</h3>
                      <table className="w-full text-sm">
                        <tbody>
                          {items.map((item) => (
                            <tr key={item.name} className="border-b border-gray-100">
                              <td className="py-1.5 text-gray-700">{item.name}</td>
                              <td className="py-1.5 text-right text-gray-600">{item.quantity}x</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
