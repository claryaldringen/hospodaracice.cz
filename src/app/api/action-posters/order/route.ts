import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { isAuthenticated } from '@/app/lib/auth';

let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}

export async function PATCH(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = body?.ids;
  if (!Array.isArray(ids) || !ids.every((x) => Number.isInteger(x) && (x as number) > 0)) {
    return NextResponse.json({ message: 'Body must be { ids: number[] }' }, { status: 400 });
  }
  const idSet = new Set<number>(ids as number[]);
  if (idSet.size !== ids.length) {
    return NextResponse.json({ message: 'Duplicate ids' }, { status: 400 });
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query<{ id: number }>(
      'SELECT id FROM action_posters FOR UPDATE'
    );
    const existingIds = new Set(existing.rows.map((r) => r.id));
    if (
      existingIds.size !== idSet.size ||
      [...idSet].some((id) => !existingIds.has(id))
    ) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { message: 'ids must match exactly the existing posters' },
        { status: 400 }
      );
    }

    for (let i = 0; i < ids.length; i++) {
      await client.query('UPDATE action_posters SET position = $1 WHERE id = $2', [
        i + 1,
        ids[i],
      ]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return NextResponse.json({ message: 'Reordered' });
}
