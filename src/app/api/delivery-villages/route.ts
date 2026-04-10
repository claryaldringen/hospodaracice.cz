import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/app/lib/auth';
import { query } from '@/app/lib/db';

export async function GET() {
  const rows = await query<{ name: string }>('SELECT name FROM delivery_villages ORDER BY name');
  return NextResponse.json({ villages: rows.map((r) => r.name) });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { villages } = await req.json();
  const list = (villages as string)
    .split('\n')
    .map((v: string) => v.trim())
    .filter((v: string) => v.length > 0);

  await query('DELETE FROM delivery_villages');
  for (const name of list) {
    await query('INSERT INTO delivery_villages (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
  }

  return NextResponse.json({ ok: true });
}
