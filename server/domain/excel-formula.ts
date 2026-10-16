// Evaluador seguro de fórmulas de la práctica de Excel. Lo usan el servidor (para calificar) y la
// mini hoja del navegador (solo para mostrar). No usa eval ni Function: reconoce una gramática
// cerrada y rechaza todo lo demás.
//
// Admitido (sin distinguir mayúsculas ni espacios):
//   =REF-REF      =REF+REF
//   =SUMA(ARG;ARG...)  =SUM(ARG,ARG...)   con ARG = REF o RANGO (REF:REF)

export type CellValue = number | string | null | undefined;
export type CellReader = (column: number, row: number) => CellValue;
export type FormulaResult = { ok: true; value: number; kind: 'diferencia' | 'suma' | 'resta' | 'total' } | { ok: false; error: string };

export const MAX_ROW = 500;
export const MAX_COLUMN = 26;
const MAX_RANGE_CELLS = 5000;
const MAX_ARGUMENTS = 20;

const REF = /^([A-Z])([1-9]\d{0,2})$/;

export function parseRef(value: string): { column: number; row: number } | null {
  const match = REF.exec(value);
  if (!match) return null;
  const row = Number(match[2]);
  if (row < 1 || row > MAX_ROW) return null;
  return { column: match[1]!.charCodeAt(0) - 64, row };
}

export function columnLabel(column: number): string {
  return String.fromCharCode(64 + column);
}

function numeric(value: CellValue): number | null {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  return Number(text);
}

// Texto de una fórmula escrita por el asesor, sin espacios y en mayúsculas.
export function normalizeFormula(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

export function evaluateFormula(input: string, read: CellReader): FormulaResult {
  const text = normalizeFormula(input);
  if (!text.startsWith('=')) return { ok: false, error: 'La fórmula debe empezar con =.' };
  if (text.length > 120) return { ok: false, error: 'La fórmula es demasiado larga.' };
  const body = text.slice(1);

  const binary = /^([A-Z]\d{1,3})([+-])([A-Z]\d{1,3})$/.exec(body);
  if (binary) {
    const left = parseRef(binary[1]!);
    const right = parseRef(binary[3]!);
    if (!left || !right) return { ok: false, error: 'Referencia de celda no válida.' };
    const a = numeric(read(left.column, left.row));
    const b = numeric(read(right.column, right.row));
    if (a === null || b === null) return { ok: false, error: '#VALOR!' };
    return binary[2] === '+' ? { ok: true, value: round(a + b), kind: 'suma' } : { ok: true, value: round(a - b), kind: 'resta' };
  }

  const sum = /^(SUMA|SUM)\(([A-Z0-9:;,]+)\)$/.exec(body);
  if (sum) {
    const args = sum[2]!.split(/[;,]/);
    if (args.length === 0 || args.length > MAX_ARGUMENTS || args.some((arg) => arg === '')) return { ok: false, error: 'Argumentos no válidos.' };
    let total = 0;
    let cells = 0;
    for (const arg of args) {
      const [startText, endText, extra] = arg.split(':');
      if (extra !== undefined) return { ok: false, error: 'Rango no válido.' };
      const start = parseRef(startText!);
      const end = endText === undefined ? start : parseRef(endText);
      if (!start || !end) return { ok: false, error: 'Referencia de celda no válida.' };
      const [c1, c2] = [Math.min(start.column, end.column), Math.max(start.column, end.column)];
      const [r1, r2] = [Math.min(start.row, end.row), Math.max(start.row, end.row)];
      cells += (c2 - c1 + 1) * (r2 - r1 + 1);
      if (cells > MAX_RANGE_CELLS) return { ok: false, error: 'El rango es demasiado grande.' };
      for (let column = c1; column <= c2; column++) {
        for (let row = r1; row <= r2; row++) {
          const value = read(column, row);
          // Como en una hoja de cálculo, el texto dentro de un rango se ignora.
          if (typeof value === 'string' && value.trim() !== '' && numeric(value) === null) continue;
          total += numeric(value) ?? 0;
        }
      }
    }
    return { ok: true, value: round(total), kind: 'total' };
  }
  return { ok: false, error: 'Fórmula no admitida: usa =A1-B1, =A1+B1 o =SUMA(A1:A10).' };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export const isSumFormula = (input: string): boolean => /^=(SUMA|SUM)\(/.test(normalizeFormula(input));
