import { levenshtein, lower, normalizeSpelling, stripDiacritics, tokenize, type Token } from './tokenize.js';

// Sistema experto del dictado: determinístico, sin red y sin IA. Compara lo escrito con el texto
// esperado, clasifica cada diferencia, aplica el catálogo de reglas y calcula la nota.

export type ErrorType = 'OMISION' | 'INSERCION' | 'SUSTITUCION' | 'TILDE' | 'MAYUSCULA' | 'PUNTUACION';
export type RuleCategory = 'HOMOFONA' | 'TILDE_DIACRITICA' | 'FORMA_VERBAL' | 'PUNTUACION' | 'MAYUSCULA';
export type Severity = 'CRITICAL' | 'MINOR';

export type SpellingRuleInput = {
  key: string;
  category: RuleCategory;
  severity: Severity;
  weight: number;
  // Pares no ordenados: [esperado, confusión frecuente] o al revés.
  pairs: [string, string][];
  explanation: string;
};

export type DetectedError = {
  position: number;
  type: ErrorType;
  expected: string;
  written: string;
  ruleKey: string | null;
  category: RuleCategory | null;
  severity: Severity;
  weight: number;
  explanation: string;
};

export type DictationEvaluation = {
  score: number;
  passed: boolean;
  criticalCount: number;
  wordMatchPercent: number;
  errors: DetectedError[];
  expectedNormalized: string;
  typedNormalized: string;
};

// Pesos iniciales del documento (se pueden sobrescribir con reglas de catálogo sin pares).
export const DEFAULT_WEIGHTS: Record<ErrorType, number> = {
  OMISION: 8, INSERCION: 8, SUSTITUCION: 8, TILDE: 3, PUNTUACION: 2, MAYUSCULA: 1,
};
export const CRITICAL_WEIGHT = 15;

type Op = { kind: 'match' | 'sub' | 'ins' | 'del'; expected?: Token; typed?: Token };

function substitutionCost(expected: Token, typed: Token): number {
  if (expected.text === typed.text) return 0;
  if (expected.kind !== typed.kind) return 1.6;
  if (expected.kind === 'punct') return 0.9;
  if (lower(expected.text) === lower(typed.text)) return 0.1;
  if (stripDiacritics(lower(expected.text)) === stripDiacritics(lower(typed.text))) return 0.2;
  const distance = levenshtein(lower(expected.text), lower(typed.text));
  return 0.6 + 0.4 * Math.min(1, distance / Math.max(expected.text.length, typed.text.length));
}

// Alineación por palabra con retroceso. A igualdad de costo se prefiere la diagonal.
function align(expected: Token[], typed: Token[]): Op[] {
  const n = expected.length;
  const m = typed.length;
  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) cost[i]![0] = i;
  for (let j = 1; j <= m; j++) cost[0]![j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      cost[i]![j] = Math.min(
        cost[i - 1]![j - 1]! + substitutionCost(expected[i - 1]!, typed[j - 1]!),
        cost[i - 1]![j]! + 1,
        cost[i]![j - 1]! + 1,
      );
    }
  }
  const ops: Op[] = [];
  let i = n;
  let j = m;
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && near(cost[i]![j]!, cost[i - 1]![j - 1]! + substitutionCost(expected[i - 1]!, typed[j - 1]!))) {
      const same = expected[i - 1]!.text === typed[j - 1]!.text;
      ops.push({ kind: same ? 'match' : 'sub', expected: expected[i - 1], typed: typed[j - 1] });
      i -= 1; j -= 1;
    } else if (i > 0 && near(cost[i]![j]!, cost[i - 1]![j]! + 1)) {
      ops.push({ kind: 'del', expected: expected[i - 1] });
      i -= 1;
    } else {
      ops.push({ kind: 'ins', typed: typed[j - 1] });
      j -= 1;
    }
  }
  return ops.reverse();
}

const wordsOf = (tokens: (Token | undefined)[]): string => tokens.filter((token): token is Token => Boolean(token) && token!.kind === 'word').map((token) => lower(token.text)).join(' ');

function pairMatches(rule: SpellingRuleInput, expected: string, written: string): boolean {
  return rule.pairs.some(([a, b]) => {
    const x = lower(a);
    const y = lower(b);
    return (expected === x && written === y) || (expected === y && written === x);
  });
}

function classify(op: Op): ErrorType {
  const expected = op.expected;
  const typed = op.typed;
  if (op.kind === 'del') return expected!.kind === 'punct' ? 'PUNTUACION' : 'OMISION';
  if (op.kind === 'ins') return typed!.kind === 'punct' ? 'PUNTUACION' : 'INSERCION';
  if (expected!.kind === 'punct' && typed!.kind === 'punct') return 'PUNTUACION';
  if (expected!.kind !== typed!.kind) return 'SUSTITUCION';
  if (lower(expected!.text) === lower(typed!.text)) return 'MAYUSCULA';
  // Diferencia solo de tilde: compara carácter por carácter sin descartar la tilde antes de clasificar.
  if (stripDiacritics(lower(expected!.text)) === stripDiacritics(lower(typed!.text))) return 'TILDE';
  return 'SUSTITUCION';
}

function defaultExplanation(type: ErrorType, expected: string, written: string): string {
  switch (type) {
    case 'OMISION': return `Falta ${/^[\p{L}\p{N}]/u.test(expected) ? 'la palabra' : 'el signo'} «${expected}».`;
    case 'INSERCION': return `Sobra ${/^[\p{L}\p{N}]/u.test(written) ? 'la palabra' : 'el signo'} «${written}».`;
    case 'TILDE': return `Revisa la tilde: se escribe «${expected}», no «${written}».`;
    case 'MAYUSCULA': return `Revisa las mayúsculas: se escribe «${expected}», no «${written}».`;
    case 'PUNTUACION': return expected && !written ? `Falta el signo «${expected}».` : written && !expected ? `Sobra el signo «${written}».` : `Se esperaba «${expected}» y escribiste «${written}».`;
    default: return `Escribiste «${written}» y la palabra correcta era «${expected}».`;
  }
}

export type EvaluateOptions = { minScore: number };

export function evaluateDictation(expectedText: string, typedText: string, rules: SpellingRuleInput[], options: EvaluateOptions): DictationEvaluation {
  const expectedNormalized = normalizeSpelling(expectedText);
  const typedNormalized = normalizeSpelling(typedText);
  const expected = tokenize(expectedNormalized);
  const typed = tokenize(typedNormalized);
  const ops = align(expected, typed);
  const categoryRule = (category: RuleCategory) => rules.find((rule) => rule.category === category && rule.pairs.length === 0);
  const pairRules = rules.filter((rule) => rule.pairs.length > 0);

  const errors: DetectedError[] = [];
  const used = new Set<number>();
  const positionOf = (op: Op) => op.expected?.index ?? Math.max(0, (op.typed?.index ?? 0) - 1);

  // Reglas del catálogo sobre tramos contiguos de operaciones que no coinciden (incluye pares de varias palabras).
  for (let start = 0; start < ops.length; start++) {
    if (used.has(start) || ops[start]!.kind === 'match') continue;
    let end = start;
    while (end + 1 < ops.length && ops[end + 1]!.kind !== 'match' && !used.has(end + 1)) end += 1;
    // Tramos más largos primero, para que «a ver» / «haber» gane a coincidencias parciales.
    let matched = false;
    for (let from = start; from <= end && !matched; from++) {
      for (let to = end; to >= from && !matched; to--) {
        const slice = ops.slice(from, to + 1);
        const expectedWords = wordsOf(slice.map((op) => op.expected));
        const typedWords = wordsOf(slice.map((op) => op.typed));
        if (!expectedWords || !typedWords || expectedWords === typedWords) continue;
        const rule = pairRules.find((candidate) => pairMatches(candidate, expectedWords, typedWords));
        if (!rule) continue;
        const critical = rule.severity === 'CRITICAL';
        const onlyTilde = stripDiacritics(expectedWords) === stripDiacritics(typedWords);
        const type: ErrorType = onlyTilde ? 'TILDE' : 'SUSTITUCION';
        errors.push({
          position: positionOf(slice[0]!), type,
          expected: slice.map((op) => op.expected?.text).filter(Boolean).join(' '),
          written: slice.map((op) => op.typed?.text).filter(Boolean).join(' '),
          ruleKey: rule.key, category: rule.category, severity: rule.severity,
          weight: critical ? rule.weight || CRITICAL_WEIGHT : rule.weight || DEFAULT_WEIGHTS[type],
          explanation: rule.explanation,
        });
        for (let index = from; index <= to; index++) used.add(index);
        matched = true;
      }
    }
  }

  // Lo que ninguna regla explica se clasifica por tipo con los pesos iniciales.
  ops.forEach((op, index) => {
    if (op.kind === 'match' || used.has(index)) return;
    const type = classify(op);
    const expectedText2 = op.expected?.text ?? '';
    const writtenText = op.typed?.text ?? '';
    const generic = type === 'PUNTUACION' || type === 'MAYUSCULA' ? categoryRule(type === 'PUNTUACION' ? 'PUNTUACION' : 'MAYUSCULA') : undefined;
    errors.push({
      position: positionOf(op), type, expected: expectedText2, written: writtenText,
      ruleKey: generic?.key ?? null, category: generic?.category ?? null, severity: 'MINOR',
      weight: generic?.weight ?? DEFAULT_WEIGHTS[type],
      explanation: defaultExplanation(type, expectedText2, writtenText),
    });
  });

  errors.sort((a, b) => a.position - b.position);
  const total = errors.reduce((sum, error) => sum + error.weight, 0);
  const score = Math.max(0, Math.round((100 - total) * 100) / 100);
  const criticalCount = errors.filter((error) => error.severity === 'CRITICAL').length;
  const expectedWords = expected.filter((token) => token.kind === 'word');
  const matchedWords = ops.filter((op) => op.kind !== 'ins' && op.expected?.kind === 'word' && op.typed?.kind === 'word' && lower(op.expected.text) === lower(op.typed.text)).length;
  const wordMatchPercent = expectedWords.length === 0 ? 0 : Math.round((matchedWords / expectedWords.length) * 10000) / 100;
  return {
    score, passed: score >= options.minScore && criticalCount === 0, criticalCount, wordMatchPercent,
    errors, expectedNormalized, typedNormalized,
  };
}

// Correcciones para mostrar: primero las críticas y luego las de mayor peso; el resto se despliega.
export function prioritize(errors: DetectedError[]): DetectedError[] {
  return [...errors].sort((a, b) => {
    const critical = Number(b.severity === 'CRITICAL') - Number(a.severity === 'CRITICAL');
    return critical || b.weight - a.weight || a.position - b.position;
  });
}
