import { ValidationError } from '../domain/errors.js';

// Cursor opaco para paginación estable por (fecha desc, id desc).
export type Cursor = { at: Date; id: string };

export function encodeCursor(at: Date, id: string): string {
  return Buffer.from(JSON.stringify([at.toISOString(), id])).toString('base64url');
}

export function decodeCursor(value: string | undefined): Cursor | null {
  if (!value) return null;
  try {
    const [at, id] = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as [unknown, unknown];
    const date = new Date(String(at));
    if (typeof id !== 'string' || Number.isNaN(date.getTime())) throw new Error('cursor');
    return { at: date, id };
  } catch {
    throw new ValidationError('El cursor de paginación no es válido.', { cursor: 'Cursor inválido.' });
  }
}

// Recorta la página pedida (se consultan limit + 1 filas) y calcula el siguiente cursor.
export function pageOf<T>(rows: T[], limit: number, key: (row: T) => { at: Date; id: string }): { items: T[]; nextCursor: string | null } {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  const nextCursor = rows.length > limit && last ? encodeCursor(key(last).at, key(last).id) : null;
  return { items, nextCursor };
}
