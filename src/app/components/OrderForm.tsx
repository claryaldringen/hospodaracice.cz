'use client';

import { useState, useEffect, useCallback } from 'react';
import type { WeeklyMenu, MenuDay, OrderItem } from '@/app/types';

export default function OrderForm() {
  const [menu, setMenu] = useState<WeeklyMenu | null>(null);
  const [villages, setVillages] = useState<string[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedDay, setSelectedDay] = useState<MenuDay | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [village, setVillage] = useState('');
  const [note, setNote] = useState('');
  const [gdprConsent, setGdprConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    const [menuRes, villagesRes] = await Promise.all([
      fetch('/api/menu'),
      fetch('/api/delivery-villages'),
    ]);
    if (menuRes.ok) {
      const data = await menuRes.json();
      setMenu(data);
    }
    if (villagesRes.ok) {
      const data = await villagesRes.json();
      setVillages(data.villages || []);
      if (data.villages?.length > 0) {
        setVillage(data.villages[0]);
      }
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const availableDays =
    menu?.days.filter((d) => {
      // Deadline: den předem v 10:00
      const deadline = new Date(d.date + 'T10:00:00');
      deadline.setDate(deadline.getDate() - 1);
      return new Date() < deadline;
    }) || [];

  function formatDate(dateStr: string) {
    const [, m, d] = dateStr.split('-');
    return `${parseInt(d)}.${parseInt(m)}.`;
  }

  const handleQuantity = (mealKey: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[mealKey] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [mealKey]: next };
    });
  };

  const handleSelectDay = (day: MenuDay) => {
    setSelectedDay(day);
    setQuantities({});
  };

  const orderItems: OrderItem[] = selectedDay
    ? selectedDay.meals
        .map((meal, i) => ({
          name: meal.name,
          price: meal.price,
          quantity: quantities[`${selectedDay.day}-${i}`] || 0,
        }))
        .filter((item) => item.quantity > 0)
    : [];

  const totalPrice = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const isValidPhone = (value: string) => {
    const digits = value.replace(/[\s\-\+\(\)]/g, '');
    return /^\d{9,12}$/.test(digits);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDay || orderItems.length === 0) {
      setResult({ type: 'error', text: 'Vyberte alespoň jedno jídlo.' });
      return;
    }
    if (!isValidPhone(phone)) {
      setResult({ type: 'error', text: 'Zadejte platné telefonní číslo.' });
      return;
    }
    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          address,
          village,
          note,
          day: selectedDay.day,
          date: selectedDay.date,
          items: orderItems,
        }),
      });

      if (res.ok) {
        setResult({ type: 'success', text: 'Objednávka odeslána!' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setName('');
        setPhone('');
        setAddress('');
        setNote('');
        setQuantities({});
      } else {
        const data = await res.json();
        setResult({ type: 'error', text: data.error || 'Chyba při odesílání objednávky.' });
      }
    } catch {
      setResult({ type: 'error', text: 'Chyba při odesílání.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!menu || availableDays.length === 0) {
    return null;
  }

  return (
    <div id="objednavka" className="w-full p-4">
      <h2 className="mb-4 text-center text-xl font-bold text-white">Objednávka jídla</h2>

      {result && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-center text-sm font-medium ${
            result.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {result.text}
        </div>
      )}

      {/* Day selection */}
      <div className="mb-4 flex flex-wrap gap-2">
        {availableDays.map((day) => (
          <button
            key={day.date}
            onClick={() => handleSelectDay(day)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              selectedDay?.date === day.date
                ? 'bg-white text-gray-900'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            {day.day}
            <span className="ml-1 text-xs opacity-70">{formatDate(day.date)}</span>
          </button>
        ))}
      </div>

      {selectedDay && (
        <form onSubmit={handleSubmit}>
          {/* Menu items */}
          <div className="mb-4 rounded-xl bg-white/10 p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">
              {selectedDay.day} {formatDate(selectedDay.date)}
            </h3>
            <div className="space-y-3">
              {selectedDay.meals.map((meal, i) => {
                const key = `${selectedDay.day}-${i}`;
                const qty = quantities[key] || 0;
                return (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white">{meal.name}</p>
                      <p className="text-sm text-white/60">{meal.price} Kč</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuantity(key, -1)}
                        disabled={qty === 0}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 text-white transition hover:bg-white/10 disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-medium text-white">{qty}</span>
                      <button
                        type="button"
                        onClick={() => handleQuantity(key, 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 text-white transition hover:bg-white/10"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {totalPrice > 0 && (
              <div className="mt-3 border-t border-white/20 pt-3 text-right text-sm font-bold text-white">
                Celkem: {totalPrice} Kč
              </div>
            )}
          </div>

          {/* Contact form */}
          <div className="space-y-3">
            <input
              type="text"
              required
              placeholder="Jméno"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/50 transition focus:border-white/50 focus:outline-none"
            />
            <input
              type="tel"
              required
              placeholder="Telefon"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/50 transition focus:border-white/50 focus:outline-none"
            />
            <select
              required
              value={village}
              onChange={(e) => setVillage(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white transition focus:border-white/50 focus:outline-none"
            >
              {villages.map((v) => (
                <option key={v} value={v} className="text-gray-900">
                  {v}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              placeholder="Adresa"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/50 transition focus:border-white/50 focus:outline-none"
            />
            <textarea
              rows={2}
              placeholder="Poznámka (volitelná)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/50 transition focus:border-white/50 focus:outline-none"
            />
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm text-white/70">
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
                className="text-blue-400 underline hover:text-blue-300"
              >
                zpracováním osobních údajů
              </a>{' '}
              za účelem vyřízení objednávky.
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting || orderItems.length === 0 || !gdprConsent}
            className="mt-4 w-full rounded-lg bg-white py-2.5 text-sm font-medium text-gray-900 shadow transition hover:bg-gray-100 active:bg-gray-200 disabled:opacity-50"
          >
            {submitting ? 'Odesílání…' : `Objednat (${totalPrice} Kč)`}
          </button>
        </form>
      )}
    </div>
  );
}
