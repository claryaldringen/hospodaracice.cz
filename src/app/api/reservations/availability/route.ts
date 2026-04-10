import { NextRequest, NextResponse } from 'next/server';
import { getReservationsByDate, getTotalSeats } from '@/app/lib/reservations';

const HOURS = Array.from({ length: 14 }, (_, i) => {
  const h = i + 8;
  return `${h.toString().padStart(2, '0')}:00`;
}); // 08:00 – 21:00

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date');
  if (!date) {
    return NextResponse.json({ error: 'Parametr date je povinný.' }, { status: 400 });
  }

  const reservations = await getReservationsByDate(date);
  const totalSeats = getTotalSeats();

  const hours = HOURS.map((hour) => {
    const nextHour = `${(parseInt(hour) + 1).toString().padStart(2, '0')}:00`;
    const reserved = reservations
      .filter((r) => r.timeFrom < nextHour && r.timeTo > hour)
      .reduce((sum, r) => sum + r.seats, 0);
    return { hour, reserved };
  });

  return NextResponse.json({ date, totalSeats, hours });
}
