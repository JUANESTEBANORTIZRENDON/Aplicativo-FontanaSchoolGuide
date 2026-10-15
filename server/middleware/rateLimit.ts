import type { NextFunction, Request, Response } from 'express';
import { LOGIN_LIMITS } from '../config/security.js';
import { TooManyRequestsError } from '../domain/errors.js';

// Almacén de contadores. La implementación en memoria sirve para una sola instancia (Render);
// con varias instancias se sustituye por una basada en Redis u otra base compartida.
export interface RateLimitStore {
  get(key: string): Promise<{ count: number; resetAt: number } | null>;
  increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
  reset(key: string): Promise<void>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly entries = new Map<string, { count: number; resetAt: number }>();

  async get(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.resetAt <= Date.now()) { this.entries.delete(key); return null; }
    return entry;
  }

  async increment(key: string, windowMs: number) {
    const current = await this.get(key);
    const next = current ? { count: current.count + 1, resetAt: current.resetAt } : { count: 1, resetAt: Date.now() + windowMs };
    this.entries.set(key, next);
    if (this.entries.size > 10_000) this.purge();
    return next;
  }

  async reset(key: string) { this.entries.delete(key); }

  clear(): void { this.entries.clear(); }

  private purge(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) if (entry.resetAt <= now) this.entries.delete(key);
  }
}

export const rateLimitStore = new MemoryRateLimitStore();

function keys(ip: string, identificador: string) {
  return { pair: `login:${ip}:${identificador.toLowerCase()}`, ip: `login-ip:${ip}` };
}

// Cuenta fallos de inicio de sesión por IP + identificador y por IP.
export const loginLimiter = {
  async check(ip: string, identificador: string): Promise<void> {
    const k = keys(ip, identificador);
    const [pair, byIp] = await Promise.all([rateLimitStore.get(k.pair), rateLimitStore.get(k.ip)]);
    const blocked = (pair && pair.count >= LOGIN_LIMITS.perIdentifier) || (byIp && byIp.count >= LOGIN_LIMITS.perIp);
    if (blocked) {
      const resetAt = Math.max(pair?.resetAt ?? 0, byIp?.resetAt ?? 0);
      throw new TooManyRequestsError('Demasiados intentos. Espera 15 minutos.', { retryAfterSeconds: Math.ceil((resetAt - Date.now()) / 1000) });
    }
  },
  async fail(ip: string, identificador: string): Promise<void> {
    const k = keys(ip, identificador);
    await Promise.all([rateLimitStore.increment(k.pair, LOGIN_LIMITS.windowMs), rateLimitStore.increment(k.ip, LOGIN_LIMITS.windowMs)]);
  },
  async succeed(ip: string, identificador: string): Promise<void> {
    await rateLimitStore.reset(keys(ip, identificador).pair);
  },
};

export async function limitarLogin(request: Request, _response: Response, next: NextFunction): Promise<void> {
  const identificador = typeof request.body?.identificador === 'string' ? request.body.identificador.trim().slice(0, 150) : '';
  await loginLimiter.check(request.ip ?? 'unknown', identificador);
  next();
}
