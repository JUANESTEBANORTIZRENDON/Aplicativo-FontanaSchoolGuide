import type { AuthUser } from './domain/usuario.js';

declare global {
  namespace Express {
    interface Request {
      usuario?: AuthUser;
      requestId?: string;
      valid?: { body?: unknown; query?: unknown; params?: unknown };
      rawBody?: Buffer;
    }
  }
}

export {};
