'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface HourAvailability {
  hour: string;
  reserved: number;
}

interface AvailabilityData {
  totalSeats: number;
  hours: HourAvailability[];
}

const TIME_OPTIONS = Array.from({ length: 14 }, (_, i) => {
  const h = i + 8;
  return `${h.toString().padStart(2, '0')}:00`;
}); // 08:00 – 21:00

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReservationPage() {
  return (
    <Suspense>
      <ReservationContent />
    </Suspense>
  );
}

function ReservationContent() {
  const searchParams = useSearchParams();
  const confirmed = searchParams.get('confirmed');
  const cancelled = searchParams.get('cancelled');
  const error = searchParams.get('error');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [seats, setSeats] = useState(2);
  const [date, setDate] = useState(todayStr());
  const [timeFrom, setTimeFrom] = useState('18:00');
  const [timeTo, setTimeTo] = useState('20:00');
  const [note, setNote] = useState('');
  const [gdprConsent, setGdprConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);

  const loadAvailability = useCallback(async (d: string) => {
    try {
      const res = await fetch(`/api/reservations/availability?date=${d}`);
      if (res.ok) {
        setAvailability(await res.json());
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (date) loadAvailability(date);
  }, [date, loadAvailability]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, seats, date, timeFrom, timeTo, note }),
      });

      if (res.ok) {
        setResult({
          type: 'success',
          text: 'Rezervace vytvořena! Zkontrolujte svůj email a potvrďte ji.',
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setName('');
        setEmail('');
        setSeats(2);
        setNote('');
        loadAvailability(date);
      } else {
        const data = await res.json();
        setResult({ type: 'error', text: data.error || 'Chyba při vytváření rezervace.' });
      }
    } catch {
      setResult({ type: 'error', text: 'Chyba při odesílání.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Status messages from query params
  if (confirmed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-7 w-7"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Rezervace potvrzena!</h1>
          <p className="mt-2 text-gray-600">
            Vaše rezervace byla úspěšně potvrzena. Těšíme se na vás!
          </p>
          <Link href="/" className="mt-6 inline-block text-blue-600 hover:underline">
            Zpět na hlavní stránku
          </Link>
        </div>
      </div>
    );
  }

  if (cancelled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <h1 className="text-xl font-bold text-gray-900">Rezervace zrušena</h1>
          <p className="mt-2 text-gray-600">Vaše rezervace byla zrušena.</p>
          <Link href="/rezervace" className="mt-6 inline-block text-blue-600 hover:underline">
            Vytvořit novou rezervaci
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    const messages: Record<string, string> = {
      invalid: 'Neplatný odkaz.',
      not_found: 'Rezervace nebyla nalezena.',
      cancelled: 'Tato rezervace již byla zrušena.',
    };
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <h1 className="text-xl font-bold text-gray-900">Chyba</h1>
          <p className="mt-2 text-gray-600">{messages[error] || 'Nastala neočekávaná chyba.'}</p>
          <Link href="/rezervace" className="mt-6 inline-block text-blue-600 hover:underline">
            Zpět na rezervace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-12">
      <div className="mx-auto max-w-lg">
        <h1 className="mb-8 text-center text-2xl font-bold text-gray-900">Rezervace</h1>

        {result && (
          <div
            className={`mb-6 rounded-lg px-4 py-3 text-center text-sm font-medium ${
              result.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {result.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-lg">
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
                Jméno
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label htmlFor="seats" className="mb-1 block text-sm font-medium text-gray-700">
                Počet míst
              </label>
              <input
                id="seats"
                type="number"
                min={1}
                required
                value={seats}
                onChange={(e) => setSeats(parseInt(e.target.value) || 1)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label htmlFor="date" className="mb-1 block text-sm font-medium text-gray-700">
                Datum
              </label>
              <input
                id="date"
                type="date"
                required
                min={todayStr()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="timeFrom" className="mb-1 block text-sm font-medium text-gray-700">
                  Čas od
                </label>
                <select
                  id="timeFrom"
                  required
                  value={timeFrom}
                  onChange={(e) => setTimeFrom(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="timeTo" className="mb-1 block text-sm font-medium text-gray-700">
                  Čas do
                </label>
                <select
                  id="timeTo"
                  required
                  value={timeTo}
                  onChange={(e) => setTimeTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="note" className="mb-1 block text-sm font-medium text-gray-700">
                Poznámka <span className="text-gray-400">(volitelná)</span>
              </label>
              <textarea
                id="note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* Availability */}
          {availability && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-medium text-gray-700">Obsazenost na {date}</h3>
              <div className="grid grid-cols-7 gap-1">
                {availability.hours.map(({ hour, reserved }) => {
                  const pct = Math.round((reserved / availability.totalSeats) * 100);
                  const isFull = reserved >= availability.totalSeats;
                  return (
                    <div
                      key={hour}
                      className={`rounded px-1 py-1.5 text-center text-xs ${
                        isFull
                          ? 'bg-red-100 text-red-700'
                          : pct > 50
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                      }`}
                    >
                      <div className="font-medium">{hour.slice(0, 2)}</div>
                      <div>{pct}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <label className="mt-4 flex items-start gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={gdprConsent}
              onChange={(e) => setGdprConsent(e.target.checked)}
              required
              className="mt-0.5"
            />
            <span>
              Souhlasím se{' '}
              <a
                href="/ochrana-osobnich-udaju"
                target="_blank"
                className="text-blue-500 underline hover:text-blue-700"
              >
                zpracováním osobních údajů
              </a>{' '}
              za účelem vyřízení rezervace.
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting || !gdprConsent}
            className="mt-4 w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white shadow transition hover:bg-gray-800 active:bg-gray-950 disabled:opacity-50"
          >
            {submitting ? 'Odesílání…' : 'Rezervovat'}
          </button>
        </form>
      </div>
    </div>
  );
}
