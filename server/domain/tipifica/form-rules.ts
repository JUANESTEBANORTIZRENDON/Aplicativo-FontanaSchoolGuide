// Límites del formulario «Nueva Gestión» y utilidades de fecha local que comparten el clon de Control Next y el
// servidor (que califica la prueba de tipificación con las mismas reglas).

export const NOTE_MIN = 10;
export const NOTE_MAX = 500;
export const PROMISE_MAX_DAYS = 30;

export function parseAmount(value: string): number {
  const digits = value.replace(/[^\d]/g, '');
  return digits ? Number(digits) : Number.NaN;
}

const pad = (n: number): string => String(n).padStart(2, '0');

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}
