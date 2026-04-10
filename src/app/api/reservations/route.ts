import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createReservation, getReservedSeats, getTotalSeats } from '@/app/lib/reservations';
import { sendConfirmationRequest } from '@/app/lib/email';
import type { Reservation } from '@/app/types';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, seats, date, timeFrom, timeTo, note } = body;

  if (!name || !email || !seats || !date || !timeFrom || !timeTo) {
    return NextResponse.json({ error: 'Vyplňte všechna povinná pole.' }, { status: 400 });
  }

  if (seats < 1) {
    return NextResponse.json({ error: 'Počet míst musí být alespoň 1.' }, { status: 400 });
  }

  if (timeFrom >= timeTo) {
    return NextResponse.json({ error: 'Čas „od" musí být před časem „do".' }, { status: 400 });
  }

  const reserved = await getReservedSeats(date, timeFrom, timeTo);
  const totalSeats = getTotalSeats();

  if (reserved + seats > totalSeats) {
    return NextResponse.json(
      { error: `Nedostatek volných míst. Dostupných: ${totalSeats - reserved}.` },
      { status: 409 }
    );
  }

  const reservation: Reservation = {
    id: nanoid(),
    name,
    email,
    seats,
    date,
    timeFrom,
    timeTo,
    note: note || undefined,
    status: 'pending',
    token: nanoid(32),
    createdAt: new Date().toISOString(),
  };

  await createReservation(reservation);

  try {
    await sendConfirmationRequest(reservation);
  } catch {
    // Email failed but reservation is saved
  }

  return NextResponse.json({ ok: true });
}
