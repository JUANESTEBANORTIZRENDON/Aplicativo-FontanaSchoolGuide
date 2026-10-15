import { evaluateFormula, isSumFormula, parseRef, type CellValue } from './excel-formula.js';

// Escenario de la práctica de Excel: se genera con un PRNG de semilla fija por intento (cada asesor ve
// valores distintos y se pueden reproducir para revisarlos) y se califica solo en el servidor.

export type Column = { key: string; label: string; type: 'text' | 'number' | 'date' | 'time' | 'currency' };
export type Row = Record<string, string | number> & { id: string };
export type SheetData = { columns: Column[]; rows: Row[] };

export type ExcelScenarioData = {
  baseDate: string;
  pools: {
    nombres: string[]; empresas: string[]; ciudades: string[]; motivos: string[]; asesores: string[];
    estadosAcuerdo: string[]; estadosPago: string[];
  };
  rows: { busquedas: number; volver: number; acuerdos: number; pagos: number };
};

export type AnswerKeyStep = { id: string; lesson: string; kind: string; weight: number; hint: string };
export type ExcelAnswerKey = { steps: AnswerKeyStep[] };

export type ScenarioTasks = {
  company: string;
  clientName: string;
  clientCedula: string;
  callback: { cliente: string; fecha: string; hora: string };
  agreement: { cliente: string; valor: number; estado: string; fecha: string };
};

export type ExcelScenario = {
  seed: number;
  sheets: { busquedas: SheetData; volver: SheetData; acuerdos: SheetData; pagos: SheetData };
  tasks: ScenarioTasks;
};

// Lo que recibe el navegador por paso: la instrucción y, si aplica, las opciones. Nunca las respuestas.
export type PublicStep = { questionId: string; lesson: string; kind: string; instruction: string; options?: { value: string; label: string }[] };

export const FORMAT_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'cop', label: 'Moneda COP' },
  { value: 'porcentaje', label: 'Porcentaje' },
  { value: 'fecha', label: 'Fecha' },
];

export const VOLVER_NEW_ROW_ID = 'v-new';

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addDays(base: string, days: number): string {
  const date = new Date(`${base}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const pad = (value: number, size = 2) => String(value).padStart(size, '0');

export function generateScenario(data: ExcelScenarioData, seed: number): ExcelScenario {
  const random = mulberry32(seed);
  const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
  const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [copy[index], copy[other]] = [copy[other]!, copy[index]!];
    }
    return copy;
  };
  const names = shuffle(data.pools.nombres);
  const companies = shuffle(data.pools.empresas);

  // Búsquedas: cada empresa tiene al menos dos clientes para que el filtro sea útil.
  const busquedasRows: Row[] = [];
  const total = data.rows.busquedas;
  const usedCedulas = new Set<string>();
  for (let index = 0; index < total; index++) {
    let cedula = '';
    do { cedula = `CC-0000-${pad(int(1, 9999), 4)}`; } while (usedCedulas.has(cedula));
    usedCedulas.add(cedula);
    busquedasRows.push({
      id: `b${index + 1}`, cliente: names[index % names.length]!, cedula,
      telefono: `300 000 ${pad(int(0, 9999), 4)}`, correo: `cliente${pad(index + 1)}@ejemplo.test`,
      empresa: companies[index % companies.length]!, ciudad: pick(data.pools.ciudades),
    });
  }
  const company = pick(companies.slice(0, Math.min(companies.length, Math.ceil(total / 2))));
  const inCompany = busquedasRows.filter((row) => row.empresa === company);
  const target = pick(inCompany);

  // Volver a llamar: filas en desorden; el asesor agrega una y ordena todas.
  const volverRows: Row[] = [];
  for (let index = 0; index < data.rows.volver; index++) {
    volverRows.push({
      id: `v${index + 1}`, cliente: names[(index + 3) % names.length]!, telefono: `300 000 ${pad(int(0, 9999), 4)}`,
      fecha: addDays(data.baseDate, int(1, 25)), hora: `${pad(int(8, 17))}:${pad(pick([0, 15, 30, 45]))}`,
      motivo: pick(data.pools.motivos), asesor: pick(data.pools.asesores),
    });
  }
  const callbackClient = names[(data.rows.volver + 5) % names.length]!;
  const callback = { cliente: callbackClient, fecha: addDays(data.baseDate, int(3, 12)), hora: `${pad(int(9, 16))}:${pad(pick([0, 30]))}` };

  // Acuerdos: ocho registrados y uno vacío para completar.
  const acuerdosRows: Row[] = [];
  for (let index = 0; index < data.rows.acuerdos; index++) {
    acuerdosRows.push({
      id: `a${index + 1}`, cliente: names[(index + 7) % names.length]!, valor: int(150, 1900) * 1000,
      estado: pick(data.pools.estadosAcuerdo), fecha: addDays(data.baseDate, -int(1, 25)), observacion: 'Acuerdo registrado en el seguimiento.',
    });
  }
  const agreement = {
    cliente: names[(data.rows.acuerdos + 9) % names.length]!, valor: int(200, 950) * 1000,
    estado: pick(data.pools.estadosAcuerdo), fecha: addDays(data.baseDate, int(2, 10)),
  };
  acuerdosRows.push({ id: 'a-open', cliente: agreement.cliente, valor: '', estado: '', fecha: '', observacion: 'Completa los datos del acuerdo.' });

  // Pagos: columnas A a J con las que tienen sentido =H2-I2 y =SUMA(C2:C500).
  const pagosRows: Row[] = [];
  for (let index = 0; index < data.rows.pagos; index++) {
    const saldo = int(200, 3000) * 1000;
    const meta = int(400, 3500) * 1000;
    pagosRows.push({
      id: `p${index + 1}`, cliente: names[(index + 11) % names.length]!, cedula: busquedasRows[index % busquedasRows.length]!.cedula,
      saldo, fechaPago: addDays(data.baseDate, -int(0, 30)), estado: pick(data.pools.estadosPago),
      honorarios: Math.round(saldo * 0.1 / 1000) * 1000, empresa: companies[index % companies.length]!, meta,
      recaudo: Math.round(int(0, meta / 1000)) * 1000, faltante: '',
    });
  }

  return {
    seed,
    sheets: {
      busquedas: { columns: [
        { key: 'cliente', label: 'Cliente', type: 'text' }, { key: 'cedula', label: 'Cédula', type: 'text' }, { key: 'telefono', label: 'Teléfono', type: 'text' },
        { key: 'correo', label: 'Correo', type: 'text' }, { key: 'empresa', label: 'Empresa', type: 'text' }, { key: 'ciudad', label: 'Ciudad', type: 'text' },
      ], rows: busquedasRows },
      volver: { columns: [
        { key: 'cliente', label: 'Cliente', type: 'text' }, { key: 'telefono', label: 'Teléfono', type: 'text' }, { key: 'fecha', label: 'Fecha de seguimiento', type: 'date' },
        { key: 'hora', label: 'Hora', type: 'time' }, { key: 'motivo', label: 'Motivo', type: 'text' }, { key: 'asesor', label: 'Asesor', type: 'text' },
      ], rows: volverRows },
      acuerdos: { columns: [
        { key: 'cliente', label: 'Cliente', type: 'text' }, { key: 'valor', label: 'Valor del acuerdo', type: 'currency' }, { key: 'estado', label: 'Estado', type: 'text' },
        { key: 'fecha', label: 'Fecha del acuerdo', type: 'date' }, { key: 'observacion', label: 'Observación', type: 'text' },
      ], rows: acuerdosRows },
      pagos: { columns: [
        { key: 'cliente', label: 'Cliente', type: 'text' }, { key: 'cedula', label: 'Cédula', type: 'text' }, { key: 'saldo', label: 'Saldo', type: 'currency' },
        { key: 'fechaPago', label: 'Fecha de pago', type: 'date' }, { key: 'estado', label: 'Estado', type: 'text' }, { key: 'honorarios', label: 'Honorarios', type: 'currency' },
        { key: 'empresa', label: 'Empresa', type: 'text' }, { key: 'meta', label: 'Meta', type: 'currency' }, { key: 'recaudo', label: 'Recaudo', type: 'currency' },
        { key: 'faltante', label: 'Faltante', type: 'currency' },
      ], rows: pagosRows },
    },
    tasks: { company, clientName: target.cliente as string, clientCedula: target.cedula as string, callback, agreement },
  };
}

const money = (value: number) => `$ ${value.toLocaleString('es-CO')}`;
const dateText = (iso: string) => iso.split('-').reverse().join('/');

// Instrucciones por paso; el navegador las muestra y nunca recibe las respuestas.
export function publicSteps(scenario: ExcelScenario, key: ExcelAnswerKey): PublicStep[] {
  const { tasks } = scenario;
  const instruction: Record<string, string> = {
    'busquedas.filtro': `Filtra la columna Empresa por «${tasks.company}».`,
    'busquedas.localizar': `Con el filtro aplicado, selecciona a ${tasks.clientName} (cédula ${tasks.clientCedula}).`,
    'volver.registrar': `Agrega una devolución de llamada para ${tasks.callback.cliente}: fecha ${dateText(tasks.callback.fecha)} (${tasks.callback.fecha}) a las ${tasks.callback.hora}.`,
    'volver.ordenar': 'Ordena la tabla por Fecha de seguimiento, de la más próxima a la más lejana.',
    'acuerdos.completar': `Completa el acuerdo de ${tasks.agreement.cliente}: valor ${money(tasks.agreement.valor)}, estado ${tasks.agreement.estado} y fecha ${dateText(tasks.agreement.fecha)} (${tasks.agreement.fecha}).`,
    'pagos.faltante': 'En la celda J2 escribe una fórmula que calcule el faltante: la meta menos el recaudo.',
    'pagos.total': 'En cualquier celda escribe una fórmula que sume todos los saldos de la columna C (de C2 en adelante).',
    'pagos.moneda': 'Aplica a la columna Saldo el formato de moneda COP.',
  };
  return key.steps.map((step) => ({
    questionId: step.id, lesson: step.lesson, kind: step.kind,
    instruction: instruction[step.id] ?? step.hint,
    ...(step.kind === 'format' ? { options: FORMAT_OPTIONS } : {}),
  }));
}

export type StepInput = { questionId: string; value: string | number | Record<string, string | number> };
export type StepResult = { questionId: string; lesson: string; correct: boolean; awardedScore: number; weight: number; hint: string };

const norm = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const asNumber = (value: unknown): number | null => {
  const text = String(value ?? '').trim().replace(/[$\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  return Number(text);
};

function readerFor(scenario: ExcelScenario) {
  const keys = scenario.sheets.pagos.columns.map((column) => column.key);
  const rows = scenario.sheets.pagos.rows;
  return (column: number, row: number): CellValue => {
    if (row === 1) return scenario.sheets.pagos.columns[column - 1]?.label;
    const key = keys[column - 1];
    const record = rows[row - 2];
    if (!key || !record) return null;
    return record[key] as CellValue;
  };
}

function gradeStep(step: AnswerKeyStep, value: StepInput['value'] | undefined, scenario: ExcelScenario): boolean {
  if (value === undefined) return false;
  const { tasks } = scenario;
  const record = typeof value === 'object' ? value : null;
  switch (step.kind) {
    case 'filter': return typeof value === 'string' && norm(value) === norm(tasks.company);
    case 'select': return typeof value === 'string' && norm(value) === norm(tasks.clientCedula);
    case 'append-callback':
      return Boolean(record) && norm(record!.cliente) === norm(tasks.callback.cliente)
        && norm(record!.fecha) === tasks.callback.fecha && norm(record!.hora) === tasks.callback.hora;
    case 'sorted': {
      if (typeof value !== 'string') return false;
      const order = value.split(',').map((item) => item.trim()).filter(Boolean);
      const dates = new Map<string, string>(scenario.sheets.volver.rows.map((row) => [row.id, row.fecha as string]));
      dates.set(VOLVER_NEW_ROW_ID, tasks.callback.fecha);
      if (order.length !== dates.size || new Set(order).size !== order.length || order.some((id) => !dates.has(id))) return false;
      return order.every((id, index) => index === 0 || dates.get(order[index - 1]!)! <= dates.get(id)!);
    }
    case 'agreement':
      return Boolean(record) && asNumber(record!.valor) === tasks.agreement.valor
        && norm(record!.estado) === norm(tasks.agreement.estado) && norm(record!.fecha) === tasks.agreement.fecha;
    case 'formula-difference': {
      if (typeof value !== 'string') return false;
      const result = evaluateFormula(value, readerFor(scenario));
      const first = scenario.sheets.pagos.rows[0]!;
      return result.ok && !isSumFormula(value) && result.value === (first.meta as number) - (first.recaudo as number);
    }
    case 'formula-sum': {
      if (typeof value !== 'string') return false;
      const result = evaluateFormula(value, readerFor(scenario));
      const expected = scenario.sheets.pagos.rows.reduce((sum, row) => sum + (row.saldo as number), 0);
      return result.ok && isSumFormula(value) && result.value === expected;
    }
    case 'format': return typeof value === 'string' && norm(value) === 'cop';
    default: return false;
  }
}

export function gradeExcel(scenario: ExcelScenario, key: ExcelAnswerKey, steps: StepInput[], minScore: number) {
  const byId = new Map(steps.map((step) => [step.questionId, step.value]));
  const results: StepResult[] = key.steps.map((step) => {
    const correct = gradeStep(step, byId.get(step.id), scenario);
    return { questionId: step.id, lesson: step.lesson, correct, awardedScore: correct ? step.weight : 0, weight: step.weight, hint: step.hint };
  });
  const score = Math.min(100, results.reduce((sum, result) => sum + result.awardedScore, 0));
  return { results, score, passed: score >= minScore };
}

// Referencia para la mini hoja: el servidor la usa para validar rangos de fórmulas con el mismo lector.
export function describeCell(ref: string): { column: number; row: number } | null {
  return parseRef(ref.toUpperCase());
}
