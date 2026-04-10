import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/app/lib/auth';
import { query, queryOne } from '@/app/lib/db';

export async function GET() {
  const row = await queryOne<{ text: string }>('SELECT text FROM opening_hours WHERE id = 1');
  return NextResponse.json({ text: row?.text ?? '' });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { text } = await req.json();

  await query(
    'INSERT INTO opening_hours (id, text) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET text = $1',
    [text]
  );

  return NextResponse.json({ ok: true });
}
