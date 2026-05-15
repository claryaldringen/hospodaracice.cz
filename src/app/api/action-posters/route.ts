import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/app/lib/auth';
import { saveFile } from '@/app/lib/storage';
import { query, queryOne } from '@/app/lib/db';
import type { ActionPoster } from '@/app/types';

export async function GET() {
  const rows = await query<{
    id: number;
    filename: string;
    position: number;
    alt_text: string;
  }>('SELECT id, filename, position, alt_text FROM action_posters ORDER BY position ASC');

  const posters: ActionPoster[] = rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    position: r.position,
    altText: r.alt_text,
  }));

  return NextResponse.json({ posters });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ message: 'No file' }, { status: 400 });
  }

  const next = await queryOne<{ next_position: number }>(
    'SELECT COALESCE(MAX(position), 0) + 1 AS next_position FROM action_posters'
  );
  const position = next?.next_position ?? 1;

  const inserted = await queryOne<{ id: number }>(
    `INSERT INTO action_posters (filename, position) VALUES ('', $1) RETURNING id`,
    [position]
  );
  if (!inserted) {
    return NextResponse.json({ message: 'Insert failed' }, { status: 500 });
  }

  const filename = `action-${inserted.id}.webp`;
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    await saveFile('menu', filename, buffer);
  } catch {
    await query('DELETE FROM action_posters WHERE id = $1', [inserted.id]);
    return NextResponse.json({ message: 'Failed to save file' }, { status: 500 });
  }

  await query(
    'UPDATE action_posters SET filename = $1 WHERE id = $2',
    [filename, inserted.id]
  );

  return NextResponse.json({
    id: inserted.id,
    filename,
    position,
    altText: 'Plakát akce',
  });
}
