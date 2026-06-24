import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/app/lib/auth';
import { query, queryOne } from '@/app/lib/db';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GET() {
  const row = await queryOne<{ confirm_time: string }>(
    'SELECT confirm_time FROM order_settings WHERE id = 1'
  );
  return NextResponse.json({ confirmTime: row?.confirm_time ?? '16:00' });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { confirmTime } = await req.json();

  if (typeof confirmTime !== 'string' || !TIME_RE.test(confirmTime)) {
    return NextResponse.json({ error: 'Neplatný formát času (HH:MM).' }, { status: 400 });
  }

  await query(
    'INSERT INTO order_settings (id, confirm_time) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET confirm_time = $1',
    [confirmTime]
  );

  return NextResponse.json({ ok: true });
}
