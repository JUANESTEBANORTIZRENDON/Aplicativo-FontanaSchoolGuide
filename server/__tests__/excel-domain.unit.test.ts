import { describe, expect, it } from 'vitest';
import { EXCEL_ANSWER_KEY, EXCEL_SCENARIO_DATA } from '../../prisma/seed-office-content.js';
import { evaluateFormula, type CellReader } from '../domain/excel-formula.js';
import { generateScenario, gradeExcel, publicSteps, VOLVER_NEW_ROW_ID, type ExcelAnswerKey, type ExcelScenarioData, type StepInput } from '../domain/excel.js';

const grid: Record<string, number | string> = { H2: 1000, I2: 400, C2: 10, C3: 20, C4: 'texto', C5: 5 };
const read: CellReader = (column, row) => grid[`${String.fromCharCode(64 + column)}${row}`] ?? null;
const DATA = EXCEL_SCENARIO_DATA as unknown as ExcelScenarioData;
const KEY = EXCEL_ANSWER_KEY as unknown as ExcelAnswerKey;

describe('evaluador de fórmulas', () => {
  it('resta, suma y SUMA/SUM con ; o , sin distinguir mayúsculas ni espacios', () => {
    expect(evaluateFormula('=H2-I2', read)).toMatchObject({ ok: true, value: 600 });
    expect(evaluateFormula('= h2 + i2 ', read)).toMatchObject({ ok: true, value: 1400 });
    expect(evaluateFormula('=SUMA(C2:C500)', read)).toMatchObject({ ok: true, value: 35 });
    expect(evaluateFormula('=suma(C2;C3)', read)).toMatchObject({ ok: true, value: 30 });
    expect(evaluateFormula('=SUM(C2,C3,C5)', read)).toMatchObject({ ok: true, value: 35 });
  });

  it('rechaza cualquier expresión que no esté en la gramática', () => {
    for (const formula of [
      '=H2*I2', '=H2/I2', '=H2-I2-C2', '=(H2-I2)', '=1+1', '=H2', 'H2-I2', '=PROMEDIO(C2:C5)',
      '=SUMA(C2:C5)+1', '=SUMA()', '=SUMA(C2:C5:C6)', '=A0-B1', '=A501-B1', '=SUMA(A1:ZZ9999)',
      '=constructor.constructor("return process")()', '=process.exit()', '=__proto__', '=H2;I2', '=SUMA(C2:C5;)',
      '=IMPORTXML("http://x")', '=H2-I2 ', '=SUMA(' + 'C2;'.repeat(40) + 'C3)',
    ]) {
      const result = evaluateFormula(formula, read);
      // Solo '=H2-I2 ' (espacios sobrantes) es válida: los espacios se ignoran.
      if (formula === '=H2-I2 ') expect(result.ok).toBe(true);
      else expect(result, formula).toMatchObject({ ok: false });
    }
  });

  it('no usa eval ni Function', async () => {
    const source = (await import('node:fs')).readFileSync(new URL('../domain/excel-formula.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/\beval\s*\(/);
    expect(source).not.toMatch(/new\s+Function|Function\s*\(/);
  });
});

describe('escenario y calificación de Excel', () => {
  const scenario = generateScenario(DATA, 12345);

  it('es reproducible por semilla y distinto entre semillas', () => {
    expect(generateScenario(DATA, 12345)).toEqual(scenario);
    expect(generateScenario(DATA, 999).tasks).not.toEqual(scenario.tasks);
    expect(scenario.sheets.busquedas.rows).toHaveLength(10);
    expect(scenario.sheets.pagos.rows.length).toBeGreaterThanOrEqual(8);
  });

  it('solo usa datos ficticios y nunca expone respuestas en las instrucciones públicas', () => {
    const steps = publicSteps(scenario, KEY);
    expect(steps).toHaveLength(8);
    const text = JSON.stringify(steps);
    expect(text).not.toMatch(/answerKey|expected/i);
    for (const row of scenario.sheets.busquedas.rows) {
      expect(row.correo).toMatch(/@ejemplo\.test$/);
      expect(row.cedula).toMatch(/^CC-0000-\d{4}$/);
      expect(row.telefono).toMatch(/^300 000 \d{4}$/);
    }
  });

  function correctSteps(): StepInput[] {
    const { tasks, sheets } = scenario;
    const dates = new Map<string, string>(sheets.volver.rows.map((row) => [row.id, row.fecha as string]));
    dates.set(VOLVER_NEW_ROW_ID, tasks.callback.fecha);
    const order = [...dates.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id]) => id).join(',');
    return [
      { questionId: 'busquedas.filtro', value: tasks.company },
      { questionId: 'busquedas.localizar', value: tasks.clientCedula },
      { questionId: 'volver.registrar', value: { ...tasks.callback } },
      { questionId: 'volver.ordenar', value: order },
      { questionId: 'acuerdos.completar', value: { valor: tasks.agreement.valor, estado: tasks.agreement.estado, fecha: tasks.agreement.fecha } },
      { questionId: 'pagos.faltante', value: '=H2-I2' },
      { questionId: 'pagos.total', value: '=SUMA(C2:C500)' },
      { questionId: 'pagos.moneda', value: 'cop' },
    ];
  }

  it('califica los ocho pasos correctos con 100 puntos', () => {
    const graded = gradeExcel(scenario, KEY, correctSteps(), 80);
    expect(graded.score).toBe(100);
    expect(graded.passed).toBe(true);
    expect(graded.results.every((result) => result.correct)).toBe(true);
  });

  it('califica por paso y aplica el mínimo', () => {
    const steps = correctSteps().map((step) => (step.questionId === 'pagos.total' ? { ...step, value: '=C2+C3' } : step.questionId === 'volver.ordenar' ? { ...step, value: 'v1' } : step));
    const graded = gradeExcel(scenario, KEY, steps, 70);
    expect(graded.results.filter((result) => !result.correct).map((result) => result.questionId).sort()).toEqual(['pagos.total', 'volver.ordenar']);
    expect(graded.score).toBe(100 - 14 - 12);
    expect(graded.passed).toBe(true);
    expect(gradeExcel(scenario, KEY, steps, 74.01).passed).toBe(false);
    expect(gradeExcel(scenario, KEY, steps, 80).passed).toBe(false);
  });

  it('un valor escrito a mano o una fórmula distinta no cuentan como fórmula', () => {
    const first = scenario.sheets.pagos.rows[0]!;
    const handTyped = String((first.meta as number) - (first.recaudo as number));
    const steps: StepInput[] = [{ questionId: 'pagos.faltante', value: handTyped }, { questionId: 'pagos.total', value: '=H2-I2' }];
    const graded = gradeExcel(scenario, KEY, steps, 80);
    expect(graded.results.find((result) => result.questionId === 'pagos.faltante')!.correct).toBe(false);
    expect(graded.results.find((result) => result.questionId === 'pagos.total')!.correct).toBe(false);
  });

  it('los pasos faltantes valen cero', () => {
    expect(gradeExcel(scenario, KEY, [], 80)).toMatchObject({ score: 0, passed: false });
  });
});
