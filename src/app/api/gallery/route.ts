import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { isAuthenticated } from '@/app/lib/auth';
import { saveFile, deleteFile, getPublicUrl } from '@/app/lib/storage';
import { query } from '@/app/lib/db';
import type { GalleryItem } from '@/app/types';

interface GalleryRow {
  id: string;
  type: string;
  filename: string;
  created_at: Date;
}

function mapRow(row: GalleryRow): GalleryItem {
  return {
    id: row.id,
    type: row.type as GalleryItem['type'],
    url: getPublicUrl('gallery', row.filename),
    createdAt: row.created_at.toISOString(),
  };
}

export async function GET() {
  const rows = await query<GalleryRow>('SELECT * FROM gallery ORDER BY created_at DESC');
  return NextResponse.json({ items: rows.map(mapRow) });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File;
  if (!file) {
    return NextResponse.json({ error: 'Soubor nebyl poskytnut.' }, { status: 400 });
  }

  const isVideo = file.type.startsWith('video/');
  const ext = isVideo ? 'mp4' : 'webp';
  const id = nanoid();
  const filename = `gallery-${id}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await saveFile('gallery', filename, buffer);

  const rows = await query<GalleryRow>(
    `INSERT INTO gallery (id, type, filename) VALUES ($1, $2, $3) RETURNING *`,
    [id, isVideo ? 'video' : 'image', filename]
  );

  return NextResponse.json({ ok: true, item: mapRow(rows[0]) });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'ID je povinné.' }, { status: 400 });
  }

  const rows = await query<GalleryRow>('SELECT * FROM gallery WHERE id = $1', [id]);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Položka nenalezena.' }, { status: 404 });
  }

  await deleteFile('gallery', rows[0].filename);
  await query('DELETE FROM gallery WHERE id = $1', [id]);

  return NextResponse.json({ ok: true });
}
