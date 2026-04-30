import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/app/lib/auth';
import { deleteFile } from '@/app/lib/storage';
import { query } from '@/app/lib/db';
import { isValidWeekKey } from '@/app/lib/week';

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { type, week } = await req.json();

  if (!type) {
    return NextResponse.json({ message: 'No type provided' }, { status: 400 });
  }

  if (type === 'weekly') {
    if (!week || !isValidWeekKey(week)) {
      return NextResponse.json({ message: 'Invalid or missing week' }, { status: 400 });
    }
    await deleteFile('menu', `weekly-${week}.webp`);
    await query('DELETE FROM weekly_menu WHERE week_start = $1', [week]);
  } else {
    await deleteFile('menu', `${type}.webp`);
    await query('DELETE FROM menu_images WHERE type = $1', [type]);
  }

  return NextResponse.json({ message: 'Deleted successfully' });
}
