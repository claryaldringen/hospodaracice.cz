import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/app/lib/auth';
import { findById, updateStatus } from '@/app/lib/reservations';

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'ID je povinné.' }, { status: 400 });
  }

  const reservation = await findById(id);
  if (!reservation) {
    return NextResponse.json({ error: 'Rezervace nenalezena.' }, { status: 404 });
  }

  await updateStatus(id, 'cancelled');

  return NextResponse.json({ ok: true });
}
