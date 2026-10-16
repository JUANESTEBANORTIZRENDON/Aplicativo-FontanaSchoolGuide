// Utilidades de fecha en hora local del equipo. Las fechas "solo día" usan el formato aaaa-mm-dd.

const pad = (n: number): string => String(n).padStart(2, '0');

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Interpreta `aaaa-mm-dd` como medianoche local (Date.parse lo tomaría como UTC). */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Días de calendario entre dos instantes (positivo si `to` es posterior). */
export function calendarDaysBetween(from: Date, to: Date): number {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function isSameDay(a: Date, b: Date): boolean {
  return toDateKey(a) === toDateKey(b);
}

/** Valor para un `<input type="datetime-local">`. */
export function toDateTimeLocal(date: Date): string {
  return `${toDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
