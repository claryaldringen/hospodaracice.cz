import { writeFile, unlink, access, mkdir } from 'fs/promises';
import path from 'path';

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');

export function getFilePath(subdir: string, filename: string): string {
  return path.join(UPLOADS_DIR, subdir, filename);
}

export function getPublicUrl(subdir: string, filename: string): string {
  const base = process.env.NEXT_PUBLIC_UPLOADS_URL || '/uploads';
  return `${base}/${subdir}/${filename}`;
}

export async function saveFile(subdir: string, filename: string, data: Buffer): Promise<void> {
  const dir = path.join(UPLOADS_DIR, subdir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), data);
}

export async function deleteFile(subdir: string, filename: string): Promise<void> {
  try {
    await unlink(getFilePath(subdir, filename));
  } catch {
    // File may not exist
  }
}

export async function fileExists(subdir: string, filename: string): Promise<boolean> {
  try {
    await access(getFilePath(subdir, filename));
    return true;
  } catch {
    return false;
  }
}
