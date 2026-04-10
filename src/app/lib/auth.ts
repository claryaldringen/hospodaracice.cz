import { createHmac } from 'crypto';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'session';
const SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours

function getSecret(): string {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error('ADMIN_SECRET is not set');
  return secret;
}

export function createSessionToken(): string {
  const expires = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `${expires}`;
  const signature = createHmac('sha256', getSecret()).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string): boolean {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expected = createHmac('sha256', getSecret()).update(payload).digest('hex');
  if (signature !== expected) return false;

  const expires = parseInt(payload, 10);
  if (Date.now() > expires) return false;

  return true;
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  return verifySessionToken(token);
}

export { SESSION_COOKIE, SESSION_MAX_AGE };
