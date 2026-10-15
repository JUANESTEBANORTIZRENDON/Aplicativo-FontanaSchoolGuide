import { env } from '../config/env.js';

// Diferencia en minutos entre la hora local de `timeZone` y UTC para un instante dado.
function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant).map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

// Convierte una fecha 'YYYY-MM-DD' (o fecha-hora sin zona) interpretada en APP_TIMEZONE a UTC.
export function zonedToUtc(value: string, timeZone = env.APP_TIMEZONE): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);
  if (!match) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new RangeError('Fecha inválida');
    return date;
  }
  const [, y, m, d, hh = '0', mm = '0', ss = '0'] = match;
  const naive = Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
  const first = naive - offsetMinutes(new Date(naive), timeZone) * 60_000;
  return new Date(naive - offsetMinutes(new Date(first), timeZone) * 60_000);
}

// Rango [from, to) en UTC: `to` como fecha sin hora incluye el día completo.
export function rangeToUtc(from?: string, to?: string): { from?: Date; to?: Date } {
  const result: { from?: Date; to?: Date } = {};
  if (from) result.from = zonedToUtc(from);
  if (to) {
    const end = zonedToUtc(to);
    result.to = /^\d{4}-\d{2}-\d{2}$/.test(to) ? new Date(end.getTime() + 24 * 60 * 60_000) : end;
  }
  return result;
}

export function formatLocal(date: Date, timeZone = env.APP_TIMEZONE): string {
  return new Intl.DateTimeFormat('es-CO', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
