import { NextResponse } from 'next/server';
import { queryOne } from '@/app/lib/db';

export async function GET() {
  const row = await queryOne<{ data: unknown }>('SELECT data FROM weekly_menu WHERE id = 1');
  return NextResponse.json(row?.data ?? { days: [] });
}
