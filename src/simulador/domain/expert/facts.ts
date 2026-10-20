// Extracción de hechos de la nota que escribe el asesor («Nueva Gestion de LLamadas»).
// Sin dependencias del DOM: se prueba en Node.

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTH_DAY = new RegExp(`\\b(\\d{1,2}) de (${MONTHS.join('|')})\\b`, 'g');

const NUMBER_WORDS: Record<string, number> = {
  cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500,
  seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900,
  diez: 10, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, quince: 15, veinticinco: 25,
};

export interface NoteFacts {
  text: string;
  norm: string;
  words: number;
  /** Teléfonos de 7 a 10 dígitos que aparecen en la nota. */
  phones: string[];
  /** La nota empieza con «<teléfono> //». */
  startsWithPhone: boolean;
  /** Valores en pesos que se mencionan (100.000, $ 250000, 300 mil, cien mil…). */
  amounts: number[];
  /** Fechas mencionadas: aaaa-mm-dd, dd/mm, «el 25», días de la semana, hoy, mañana. */
  dates: { day?: number; month?: number; weekday?: number; relative?: 'hoy' | 'manana' }[];
  /** Horas mencionadas (para volver a llamar), en minutos desde medianoche. */
  times: number[];
}

function parseAmounts(norm: string): number[] {
  const out: number[] = [];
  // 100.000 · 1.250.000 · $100000 · 100,000
  // Sin dígitos pegados a los lados: así un teléfono (3125550216) no se lee como un valor.
  for (const m of norm.matchAll(/(?<![\d.,])\$?\s?(\d{1,3}(?:[.,]\d{3})+|\d{4,9})(?![\d]|[.,]\d)/g)) {
    const n = Number(m[1]!.replace(/[.,]/g, ''));
    if (n >= 1000 && !/^3\d{9}$/.test(String(n))) out.push(n);
  }
  // 300 mil · 1,5 millones · 2 millones
  for (const m of norm.matchAll(/(\d+(?:[.,]\d+)?)\s*(mil|millon(?:es)?)\b/g)) {
    const base = Number(m[1]!.replace(',', '.'));
    out.push(Math.round(base * (m[2] === 'mil' ? 1_000 : 1_000_000)));
  }
  // cien mil · doscientos cincuenta mil
  for (const m of norm.matchAll(/\b((?:[a-z]+\s){0,3}?[a-z]+)\s+mil\b/g)) {
    const parts = m[1]!.split(' ').filter((w) => w !== 'y');
    if (!parts.length || !parts.every((w) => w in NUMBER_WORDS)) continue;
    out.push(parts.reduce((s, w) => s + NUMBER_WORDS[w]!, 0) * 1_000);
  }
  return [...new Set(out)];
}

function parseDates(norm: string): NoteFacts['dates'] {
  const out: NoteFacts['dates'] = [];
  for (const m of norm.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) out.push({ day: Number(m[3]), month: Number(m[2]) });
  for (const m of norm.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?\b/g)) out.push({ day: Number(m[1]), month: Number(m[2]) });
  for (const m of norm.matchAll(MONTH_DAY)) out.push({ day: Number(m[1]), month: MONTHS.indexOf(m[2]!) + 1 });
  for (const m of norm.matchAll(/\b(?:el|dia|para el)\s+(\d{1,2})\b(?!\s*(?:mil|millon|\d|:|am\b|pm\b|a\.?\s?m|p\.?\s?m|de la))/g)) out.push({ day: Number(m[1]) });
  WEEKDAYS.forEach((d, i) => {
    if (new RegExp(`\\b${d}\\b`).test(norm)) out.push({ weekday: i });
  });
  if (/\bhoy\b/.test(norm)) out.push({ relative: 'hoy' });
  if (/\bmanana\b/.test(norm) && !/\bde la manana\b|\bpor la manana\b|\ben la manana\b/.test(norm)) out.push({ relative: 'manana' });
  return out;
}

function parseTimes(norm: string): number[] {
  const out: number[] = [];
  for (const m of norm.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.?\s?m|p\.?\s?m|de la tarde|de la manana|de la noche)\b/g)) {
    let h = Number(m[1]);
    const pm = /p|tarde|noche/.test(m[3]!);
    if (pm && h < 12) h += 12;
    out.push(h * 60 + Number(m[2] ?? 0));
  }
  for (const m of norm.matchAll(/\b(\d{1,2}):(\d{2})\b/g)) out.push(Number(m[1]) * 60 + Number(m[2]));
  return [...new Set(out)];
}

export function extractFacts(text: string): NoteFacts {
  const norm = normalize(text);
  const phones = [...norm.matchAll(/(?<!\d)(\d[\d\s-]{5,13}\d)(?!\d)/g)]
    .map((m) => m[1]!.replace(/\D/g, ''))
    .filter((d) => d.length >= 7 && d.length <= 10);
  return {
    text,
    norm,
    words: norm ? norm.split(' ').length : 0,
    phones,
    startsWithPhone: /^\+?\d[\d\s-]{5,13}\d\s*\/\//.test(text.trim()),
    amounts: parseAmounts(norm),
    dates: parseDates(norm),
    times: parseTimes(norm),
  };
}

/** ¿La nota menciona alguna de estas expresiones? (sin tildes ni mayúsculas, por palabra completa). */
export function mentions(facts: NoteFacts, terms: string[]): boolean {
  return terms.some((t) => new RegExp(`(^|[^a-z0-9])${normalize(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(facts.norm));
}
