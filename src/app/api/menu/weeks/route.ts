import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/app/lib/auth';
import { query } from '@/app/lib/db';
import { formatWeekKey } from '@/app/lib/week';

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const rows = await query<{ week_start: Date }>(
    'SELECT week_start FROM weekly_menu ORDER BY week_start'
  );

  return NextResponse.json({ weeks: rows.map((r) => formatWeekKey(r.week_start)) });
}
