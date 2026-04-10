import { NextRequest, NextResponse } from 'next/server';
import { findByToken, updateStatus } from '@/app/lib/reservations';

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

  await updateStatus(reservation.id, 'cancelled');

  return NextResponse.redirect(`${BASE_URL}/rezervace?cancelled=1`);
}
