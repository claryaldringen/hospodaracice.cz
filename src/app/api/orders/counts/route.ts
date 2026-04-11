import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/app/lib/auth';
import { query } from '@/app/lib/db';

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');
  if (!from || !to) {
    return NextResponse.json({ error: 'Parametry from a to jsou povinné.' }, { status: 400 });
  }

  const rows = await query<{ date: string; count: string }>(
    'SELECT date, COUNT(*)::text as count FROM orders WHERE date >= $1 AND date <= $2 GROUP BY date',
    [from, to]
  );

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.date] = parseInt(row.count, 10);
  }

  return NextResponse.json({ counts });
}
