import { NextRequest, NextResponse } from 'next/server';
import { findByToken, updateStatus } from '@/app/lib/reservations';
import { sendConfirmedEmail, sendReservationNotification } from '@/app/lib/email';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(`${BASE_URL}/rezervace?error=invalid`);
  }

  const reservation = await findByToken(token);

  if (!reservation) {
    return NextResponse.redirect(`${BASE_URL}/rezervace?error=not_found`);
  }

  if (reservation.status === 'cancelled') {
    return NextResponse.redirect(`${BASE_URL}/rezervace?error=cancelled`);
  }

  if (reservation.status === 'confirmed') {
    return NextResponse.redirect(`${BASE_URL}/rezervace?confirmed=1`);
  }

  await updateStatus(reservation.id, 'confirmed');

  try {
    await sendConfirmedEmail(reservation);
  } catch (err) {
    console.error('sendConfirmedEmail failed:', err);
  }

  try {
    await sendReservationNotification(reservation);
  } catch (err) {
    console.error('sendReservationNotification failed:', err);
  }

  return NextResponse.redirect(`${BASE_URL}/rezervace?confirmed=1`);
}
