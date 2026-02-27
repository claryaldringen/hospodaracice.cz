import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { isAuthenticated } from '@/app/lib/auth';

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { url } = await req.json();

  if (!url) {
    return NextResponse.json({ message: 'No URL provided' }, { status: 400 });
  }

  try {
    await del(url, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Failed to delete the file' }, { status: 500 });
  }
}
