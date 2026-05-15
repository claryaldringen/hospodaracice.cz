import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/app/lib/auth';
import { deleteFile } from '@/app/lib/storage';
import { query, queryOne } from '@/app/lib/db';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ message: 'Invalid id' }, { status: 400 });
  }

  const row = await queryOne<{ filename: string }>(
    'SELECT filename FROM action_posters WHERE id = $1',
    [id]
  );
  if (!row) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  await query('DELETE FROM action_posters WHERE id = $1', [id]);
  await query(
    `UPDATE action_posters
     SET position = sub.new_pos
     FROM (
       SELECT id, ROW_NUMBER() OVER (ORDER BY position ASC) AS new_pos
       FROM action_posters
     ) sub
     WHERE action_posters.id = sub.id AND action_posters.position <> sub.new_pos`
  );

  await deleteFile('menu', row.filename);

  return NextResponse.json({ message: 'Deleted' });
}
