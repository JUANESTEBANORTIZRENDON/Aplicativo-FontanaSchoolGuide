import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';

const cookieName = 'fontana_session';
const lifetime = 8 * 60 * 60 * 1000;
const production = process.env.NODE_ENV === 'production';
if (production && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error('SESSION_SECRET debe tener al menos 32 caracteres en producción.');
}
const secret = process.env.SESSION_SECRET ?? randomBytes(32).toString('hex');

function signature(value: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function crearSesion(response: Response, userId: string): void {
  const payload = Buffer.from(JSON.stringify({ userId, expires: Date.now() + lifetime })).toString('base64url');
  const token = `${payload}.${signature(payload)}`;
  response.cookie(cookieName, token, {
    httpOnly: true,
    secure: production,
    sameSite: 'lax',
    path: '/',
    maxAge: lifetime,
  });
}

export function borrarSesion(response: Response): void {
  response.clearCookie(cookieName, { httpOnly: true, secure: production, sameSite: 'lax', path: '/' });
}

export function leerSesion(request: Request): string | null {
  const raw = request.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${cookieName}=`));
  if (!raw) return null;
  const [payload, received, extra] = raw.slice(cookieName.length + 1).split('.');
  if (!payload || !received || extra) return null;
  const expected = Buffer.from(signature(payload));
  const actual = Buffer.from(received);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const data: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data || typeof data !== 'object') return null;
    const session = data as { userId?: unknown; expires?: unknown };
    if (typeof session.userId !== 'string' || typeof session.expires !== 'number' || session.expires < Date.now()) return null;
    return session.userId;
  } catch {
    return null;
  }
}
