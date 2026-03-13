import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { isAuthenticated } from '@/app/lib/auth';

function createAltText(fullText: string): string {
  if (fullText.length <= 150) return fullText;
  const truncated = fullText.slice(0, 150);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const type = formData.get('type') as string;
  const ocrText = formData.get('ocrText') as string | null;

  if (!file || !type) {
    return NextResponse.json({ message: 'File or type not provided' }, { status: 400 });
  }

  const filename = `${type}.webp`;

  const blob = await put(filename, file, {
    access: 'public',
    token: process.env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: false,
  });

  let ocrUrl: string | undefined;

  if (ocrText && ocrText.trim().length > 0) {
    const ocrData = {
      fullText: ocrText.trim(),
      altText: createAltText(ocrText.trim()),
    };
    const jsonBlob = await put(`${type}.json`, JSON.stringify(ocrData), {
      access: 'public',
      contentType: 'application/json',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
    });
    ocrUrl = jsonBlob.url;
  }

  return NextResponse.json({ url: blob.url, ocrUrl });
}
