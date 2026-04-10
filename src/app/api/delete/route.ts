import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/app/lib/auth';
import { deleteFile } from '@/app/lib/storage';
import { query } from '@/app/lib/db';

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { type } = await req.json();

  if (!type) {
    return NextResponse.json({ message: 'No type provided' }, { status: 400 });
  }

  await deleteFile('menu', `${type}.webp`);

  await query('DELETE FROM menu_images WHERE type = $1', [type]);

  if (type === 'weekly') {
    await query(
      'INSERT INTO weekly_menu (id, data) VALUES (1, \'{"days":[]}\'::jsonb) ON CONFLICT (id) DO UPDATE SET data = \'{"days":[]}\'::jsonb'
    );
  }

  return NextResponse.json({ message: 'Deleted successfully' });
}
