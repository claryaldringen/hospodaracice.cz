import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/app/lib/auth';
import { getReservationsByDate } from '@/app/lib/reservations';

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const date = req.nextUrl.searchParams.get('date');
  if (!date) {
    return NextResponse.json({ error: 'Parametr date je povinný.' }, { status: 400 });
  }

  const reservations = await getReservationsByDate(date);

  return NextResponse.json({ reservations });
}
