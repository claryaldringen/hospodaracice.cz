import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
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
