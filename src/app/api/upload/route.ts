import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');

  if (authHeader !== `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const type = formData.get('type') as string;

  if (!file || !type) {
    return NextResponse.json({ message: 'File or type not provided' }, { status: 400 });
  }

  const filename = `${type}.jpg`; // Nastavení pevného názvu

  const blob = await put(filename, file, {
    access: 'public',
    token: process.env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: false,
  });

  console.log(blob);

  return NextResponse.json({ url: blob.url });
}
