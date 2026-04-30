import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/app/lib/db';
import { getCurrentWeekKey, isValidWeekKey, getMonday, formatWeekKey } from '@/app/lib/week';
import type { WeeklyMenu } from '@/app/types';

export async function GET(req: NextRequest) {
  const week = req.nextUrl.searchParams.get('week');

  if (week) {
    if (!isValidWeekKey(week)) {
      return NextResponse.json({ message: 'Invalid week' }, { status: 400 });
    }
    const row = await queryOne<{ data: WeeklyMenu }>(
      'SELECT data FROM weekly_menu WHERE week_start = $1',
      [week]
    );
    return NextResponse.json(row?.data ?? { days: [] });
  }

  const currentKey = getCurrentWeekKey();
  const nextMonday = getMonday(new Date());
  nextMonday.setDate(nextMonday.getDate() + 7);
  const nextKey = formatWeekKey(nextMonday);

  const rows = await query<{ data: WeeklyMenu }>(
    'SELECT data FROM weekly_menu WHERE week_start IN ($1, $2) ORDER BY week_start',
    [currentKey, nextKey]
  );

  const merged: WeeklyMenu = { days: [] };
  for (const row of rows) {
    if (row.data && Array.isArray(row.data.days)) {
      merged.days.push(...row.data.days);
    }
  }
  return NextResponse.json(merged);
}
