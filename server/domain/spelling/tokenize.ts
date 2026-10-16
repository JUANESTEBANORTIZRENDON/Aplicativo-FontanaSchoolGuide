// Normalización y tokenización del dictado. Se conserva el texto original; las comparaciones usan
// versiones derivadas (minúsculas para la léxica, sin tildes solo para clasificar, nunca para calificar).

export type Token = { text: string; kind: 'word' | 'punct'; index: number };

export function normalizeSpelling(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim();
}

const TOKEN = /[\p{L}\p{N}]+(?:['’][\p{L}]+)?|[^\s\p{L}\p{N}]/gu;

export function tokenize(value: string): Token[] {
  const tokens: Token[] = [];
  for (const match of normalizeSpelling(value).matchAll(TOKEN)) {
    const text = match[0];
    tokens.push({ text, kind: /^[\p{L}\p{N}]/u.test(text) ? 'word' : 'punct', index: tokens.length });
  }
  return tokens;
}

export const lower = (value: string): string => value.toLocaleLowerCase('es-CO');

// Quita las marcas diacríticas. Solo se usa para decidir si una diferencia es una tilde.
export function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
}

export function levenshtein(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  let previous = Array.from({ length: y.length + 1 }, (_, index) => index);
  for (let i = 1; i <= x.length; i++) {
    const current = [i];
    for (let j = 1; j <= y.length; j++) {
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[y.length]!;
}
