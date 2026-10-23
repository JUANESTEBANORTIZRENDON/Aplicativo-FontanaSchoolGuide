// Práctica de Excel para cobranzas: siete ejercicios sobre una hoja que se edita de verdad.
// El navegador y el servidor ejecutan este mismo motor: el navegador responde al instante; el servidor vuelve a
// aplicar cada acción, la persiste y es la única fuente de la calificación. Este archivo solo importa el
// evaluador de fórmulas (también puro) porque se empaqueta para el navegador.
import { evaluateFormula, isSumFormula, normalizeFormula, type CellReader } from './excel-formula.js';

export const EXCEL_PRACTICE_VERSION = 5;
export const EXCEL_PASS_SCORE = 80;
export const FOOTER_ID = 'total';

export type Column = 'cliente' | 'documento' | 'saldo' | 'mora' | 'estado' | 'observacion' | 'abono' | 'pendiente';
// Las columnas numéricas guardan un número, un texto vacío o una fórmula (texto que empieza con =).
export type SheetRow = { id: string; cliente: string; documento: string; saldo: number | string; mora: number | string; estado: string; observacion: string; abono: number | string; pendiente: number | string };
export type Cell = { row: string; column: Column };
export type CommandMethod = 'shortcut' | 'button';
export type ColumnDef = { key: Column; letter: string; label: string; kind: 'text' | 'money' | 'number'; width: number };

export const COLUMNS: ColumnDef[] = [
  { key: 'cliente', letter: 'A', label: 'Cliente', kind: 'text', width: 140 },
  { key: 'documento', letter: 'B', label: 'Documento', kind: 'text', width: 100 },
  { key: 'saldo', letter: 'C', label: 'Saldo', kind: 'money', width: 120 },
  { key: 'mora', letter: 'D', label: 'Días de mora', kind: 'number', width: 100 },
  { key: 'estado', letter: 'E', label: 'Estado', kind: 'text', width: 110 },
  { key: 'observacion', letter: 'F', label: 'Observación', kind: 'text', width: 190 },
  { key: 'abono', letter: 'G', label: 'Abono', kind: 'money', width: 110 },
  { key: 'pendiente', letter: 'H', label: 'Saldo pendiente', kind: 'money', width: 140 },
];
export const columnDef = (key: Column) => COLUMNS.find(column => column.key === key)!;

// Dónde mira el estudiante: la hoja marca discretamente el elemento solo si pide una pista.
export type Focus = { kind: 'menu'; column: Column } | { kind: 'cell'; cell: Cell } | { kind: 'tool'; tool: 'undo' | 'copy' | 'paste' | 'search' | 'save' };
export type ExerciseStep = { task: string; help: string; focus: Focus };
export type Exercise = { id: 'filtrar' | 'ordenar' | 'copiar' | 'buscar' | 'sumar' | 'restar' | 'guardar'; lesson: string; title: string; intro: string; hint: string; steps: ExerciseStep[] };

const cell = (row: string, column: Column): Cell => ({ row, column });
export const EXERCISES: Exercise[] = [
  { id: 'filtrar', lesson: 'busquedas', title: 'Filtrar y deshacer', intro: 'Un filtro oculta filas sin borrarlas, y Ctrl+Z deshace tu último cambio.', hint: 'Filtra Estado = Pendiente, cambia el saldo de C2 a 450000 y restáuralo con Ctrl+Z.', steps: [
    { task: 'Filtra los clientes con estado Pendiente.', help: 'Abre la flecha del encabezado Estado (E1), deja marcado solo «Pendiente» y pulsa Aceptar.', focus: { kind: 'menu', column: 'estado' } },
    { task: 'Cambia el saldo de Camila Rojas (C2) a 450000.', help: 'Haz clic en C2, escribe 450000 y pulsa Enter. También puedes escribirlo en la barra de fórmulas.', focus: { kind: 'cell', cell: cell('c1', 'saldo') } },
    { task: 'Deshaz el cambio con Ctrl+Z para volver a $400.000.', help: 'Con la hoja activa presiona Ctrl+Z, o usa el botón Deshacer de la cinta.', focus: { kind: 'tool', tool: 'undo' } },
  ] },
  { id: 'ordenar', lesson: 'ordenar', title: 'Ordenar saldos', intro: 'Al ordenar, cada cliente conserva todos sus datos: se mueve la fila completa.', hint: 'Ordena Saldo de menor a mayor y luego de mayor a menor desde la flecha del encabezado.', steps: [
    { task: 'Ordena el saldo de menor a mayor.', help: 'Abre la flecha del encabezado Saldo (C1) y elige «Ordenar de menor a mayor».', focus: { kind: 'menu', column: 'saldo' } },
    { task: 'Ahora ordena el saldo de mayor a menor.', help: 'Abre otra vez la flecha de Saldo (C1) y elige «Ordenar de mayor a menor».', focus: { kind: 'menu', column: 'saldo' } },
  ] },
  { id: 'copiar', lesson: 'atajos', title: 'Copiar y pegar', intro: 'Copiar no borra el origen: el dato queda en las dos celdas.', hint: 'Copia A2 con Ctrl+C y pégala en F3 con Ctrl+V.', steps: [
    { task: 'Copia el nombre de la celda A2 con Ctrl+C.', help: 'Haz clic en A2, Camila Rojas, y presiona Ctrl+C. Verás un borde punteado alrededor.', focus: { kind: 'cell', cell: cell('c1', 'cliente') } },
    { task: 'Pega lo copiado en la celda F3 con Ctrl+V.', help: 'Haz clic en F3, la observación de Diego Torres, y presiona Ctrl+V.', focus: { kind: 'cell', cell: cell('c2', 'observacion') } },
  ] },
  { id: 'buscar', lesson: 'busquedas', title: 'Buscar un cliente', intro: 'Buscar te lleva directo a la celda, sin recorrer toda la hoja.', hint: 'Abre el buscador con Ctrl+B y localiza a Laura Méndez.', steps: [
    { task: 'Abre el buscador con Ctrl+B.', help: 'Con la hoja activa presiona Ctrl+B, o usa el botón Buscar de la cinta.', focus: { kind: 'tool', tool: 'search' } },
    { task: 'Busca a Laura Méndez.', help: 'Escribe Laura Méndez en el cuadro Buscar y pulsa Enter. La tilde es opcional.', focus: { kind: 'tool', tool: 'search' } },
  ] },
  { id: 'sumar', lesson: 'formulas', title: 'Sumar con fórmulas', intro: 'Suma tres valores: escribe la fórmula y selecciona las celdas con el mouse.', hint: 'En C5 escribe =SUMA(, arrastra de C2 a C4 y pulsa Enter.', steps: [
    { task: 'En C5 escribe =SUMA(, selecciona C2 a C4 con el mouse y pulsa Enter.', help: 'Haz clic en C5, escribe =SUMA( y arrastra desde C2 hasta C4. Pulsa Enter: se completa el paréntesis y se calcula la suma.', focus: { kind: 'cell', cell: cell(FOOTER_ID, 'saldo') } },
  ] },
  { id: 'restar', lesson: 'formulas', title: 'Restar con fórmulas', intro: 'Resta dos valores: selecciona el primero, escribe − y selecciona el segundo.', hint: 'En C5 escribe =, haz clic en C2, escribe −, haz clic en C3 y pulsa Enter.', steps: [
    { task: 'En C5 escribe =, selecciona C2, escribe −, selecciona C3 y pulsa Enter.', help: 'Haz clic en C5 y escribe =. Haz clic en C2, escribe el signo menos (-), haz clic en C3 y pulsa Enter. La fórmula queda =C2-C3.', focus: { kind: 'cell', cell: cell(FOOTER_ID, 'saldo') } },
  ] },
  { id: 'guardar', lesson: 'atajos', title: 'Guardar cambios', intro: 'Hasta que guardes, tus cambios quedan pendientes.', hint: 'Escribe una observación en F2 y guarda con Ctrl+G.', steps: [
    { task: 'Escribe una observación para Camila Rojas en la celda F2.', help: 'Haz clic en F2, escribe por ejemplo «Prometió pagar el viernes» y pulsa Enter.', focus: { kind: 'cell', cell: cell('c1', 'observacion') } },
    { task: 'Guarda los cambios con Ctrl+G.', help: 'Presiona Ctrl+G o usa el botón Guardar de la cinta. Espera a ver «Guardado».', focus: { kind: 'tool', tool: 'save' } },
  ] },
];
// 100 puntos repartidos en centésimas exactas (la base de datos guarda dos decimales).
export function exerciseWeights(count: number): number[] {
  const base = Math.floor(10000 / count); const extra = 10000 - base * count;
  return Array.from({ length: count }, (_, i) => (base + (i < extra ? 1 : 0)) / 100);
}
const WEIGHTS = exerciseWeights(EXERCISES.length);
export const exercisePoints = (index: number) => WEIGHTS[index] ?? 0;
export const EXCEL_EXERCISE_POINTS = 100 / EXERCISES.length;

// Versiones anteriores: sus resultados cerrados se muestran con los ejercicios que tenían.
const LEGACY_EXERCISES: Record<1 | 2 | 3, { id: string; lesson: string; title: string }[]> = {
  1: [
    { id: 'filtrar', lesson: 'busquedas', title: 'Filtrar y deshacer' }, { id: 'ordenar', lesson: 'ordenar', title: 'Ordenar saldos' },
    { id: 'copiar', lesson: 'atajos', title: 'Copiar y pegar' }, { id: 'buscar', lesson: 'busquedas', title: 'Buscar un cliente' },
    { id: 'guardar', lesson: 'atajos', title: 'Guardar una observación' },
  ],
  2: [
    { id: 'filtrar', lesson: 'busquedas', title: 'Filtrar pendientes' }, { id: 'deshacer', lesson: 'atajos', title: 'Deshacer un cambio' },
    { id: 'ascendente', lesson: 'ordenar', title: 'Ordenar de menor a mayor' }, { id: 'descendente', lesson: 'ordenar', title: 'Ordenar de mayor a menor' },
    { id: 'copiar', lesson: 'atajos', title: 'Copiar una celda' }, { id: 'pegar', lesson: 'atajos', title: 'Pegar en otra celda' },
    { id: 'buscar', lesson: 'busquedas', title: 'Buscar un cliente' }, { id: 'guardar', lesson: 'atajos', title: 'Guardar los cambios' },
  ],
  3: [
    { id: 'filtrar', lesson: 'busquedas', title: 'Filtrar y deshacer' }, { id: 'ordenar', lesson: 'ordenar', title: 'Ordenar saldos' },
    { id: 'copiar', lesson: 'atajos', title: 'Copiar y pegar' }, { id: 'buscar', lesson: 'busquedas', title: 'Buscar un cliente' },
    { id: 'guardar', lesson: 'atajos', title: 'Guardar cambios' },
  ],
};
// Ejercicio actual que equivale a cada ejercicio de las versiones anteriores (las fórmulas son nuevas).
const LEGACY_TO_CURRENT: Record<1 | 2 | 3, number[]> = { 1: [0, 1, 2, 3, 6], 2: [0, 0, 1, 1, 2, 2, 3, 6], 3: [0, 1, 2, 3, 6] };

export type PracticeAction =
  | { type: 'edit'; cell: Cell; value: string }
  | { type: 'filter'; column: Column; values: string[] | null }
  | { type: 'sort'; column: Column; direction: 'asc' | 'desc' }
  | { type: 'copy' | 'paste'; cell: Cell; method: CommandMethod }
  | { type: 'undo' | 'open-search' | 'save'; method: CommandMethod }
  | { type: 'search'; query: string }
  | { type: 'reset' | 'next' | 'skip' | 'review' };

type Filters = Partial<Record<Column, string[]>>;
export type SortState = { column: Column; direction: 'asc' | 'desc' };
type Snapshot = { rows: SheetRow[]; footer: SheetRow; filters: Filters; sort: SortState | null };
export type PracticeState = {
  version: 5; revision: number; current: number; stage: number;
  rows: SheetRow[]; footer: SheetRow; filters: Filters; sort: SortState | null; history: Snapshot[];
  completed: boolean[]; visited: boolean[];
  clipboard: { cell: Cell; value: string | number } | null; query: string; found: Cell | null;
  clean: SheetRow[]; dirty: boolean; savedRows: SheetRow[] | null; savedAt: string | null; savedExercise: number | null;
  methods: { exercise: number; command: string; method: CommandMethod }[];
  feedback: string; ok: boolean;
};
// Intentos de versiones anteriores (solo se leen para convertirlos o mostrar su resultado).
export type LegacyPracticeState = {
  version: 1 | 2 | 3 | 4; revision: number; current: number; rows: SheetRow[]; completed: boolean[]; visited: boolean[];
  methods?: { exercise: number; command: string; method: CommandMethod }[]; savedRows: SheetRow[] | null; savedAt: string | null;
};
export type AnyPracticeState = PracticeState | LegacyPracticeState;
export const isCurrentPractice = (state: AnyPracticeState): state is PracticeState => state.version === EXCEL_PRACTICE_VERSION;

export function initialRows(): SheetRow[] {
  const row = (n: number, cliente: string, documento: string, saldo: number, mora: number, estado: string, abono: number, observacion = ''): SheetRow => ({ id: `c${n}`, cliente, documento, saldo, mora, estado, observacion, abono, pendiente: '' });
  return [
    row(1, 'Camila Rojas', '1020304051', 400000, 35, 'Pendiente', 100000),
    row(2, 'Diego Torres', '1030405062', 150000, 0, 'Pagado', 150000),
    row(3, 'Marta Gómez', '1010203073', 780000, 62, 'Pendiente', 0, 'Sin respuesta al teléfono.'),
    row(4, 'Andrés Pérez', '1040506084', 600000, 60, 'Promesa', 200000, 'Pagará el día 30.'),
    row(5, 'Sofía Ruiz', '1050607095', 90000, 0, 'Pagado', 90000),
    row(6, 'Julián Castro', '1060708106', 320000, 21, 'Pendiente', 0),
    row(7, 'Natalia Vargas', '1070809117', 1250000, 88, 'Pendiente', 250000, 'Solicitó refinanciar.'),
    row(8, 'Valentina Cruz', '1121314162', 185000, 12, 'Promesa', 0),
    row(9, 'Esteban Ríos', '1091011139', 540000, 44, 'Pendiente', 100000),
    row(10, 'Paola Herrera', '1101112140', 70000, 0, 'Pagado', 70000),
    row(11, 'Mateo Ortiz', '1111213151', 910000, 75, 'Pendiente', 0),
    row(12, 'Laura Méndez', '1080910128', 250000, 18, 'Promesa', 50000, 'Prometió pagar el viernes.'),
    row(13, 'Sergio Molina', '1131415173', 460000, 29, 'Pendiente', 160000),
    row(14, 'Daniela Silva', '1141516184', 130000, 0, 'Pagado', 130000),
  ];
}
// Fila de totales: queda siempre al final y no participa en filtros ni en el orden.
export const initialFooter = (): SheetRow => ({ id: FOOTER_ID, cliente: 'Total cartera', documento: '', saldo: '', mora: '', estado: '', observacion: '', abono: '', pendiente: '' });

export function newPractice(): PracticeState {
  const s: PracticeState = {
    version: 5, revision: 0, current: 0, stage: 0, rows: [], footer: initialFooter(), filters: {}, sort: null, history: [],
    completed: Array(EXERCISES.length).fill(false), visited: Array(EXERCISES.length).fill(false),
    clipboard: null, query: '', found: null, clean: [], dirty: false, savedRows: null, savedAt: null, savedExercise: null,
    methods: [], feedback: '', ok: true,
  };
  freshExercise(s, 0); return s;
}
// Cada ejercicio empieza con la hoja original; el avance de los demás no se toca.
function freshExercise(s: PracticeState, index: number): void {
  s.current = index; s.stage = 0; s.rows = initialRows(); s.footer = initialFooter();
  if (EXERCISES[index]?.lesson === 'formulas') { s.rows = s.rows.slice(0, 3); s.footer.cliente = 'Resultado'; }
  s.clean = structuredClone([...s.rows, s.footer]); s.dirty = false;
  s.filters = {}; s.sort = null; s.history = []; s.clipboard = null; s.query = ''; s.found = null; s.visited[index] = true;
  s.feedback = EXERCISES[index]!.intro; s.ok = true;
}

export function isPractice(value: unknown): value is AnyPracticeState {
  return Boolean(value && typeof value === 'object' && [1, 2, 3, 4, 5].includes((value as AnyPracticeState).version) && Array.isArray((value as AnyPracticeState).rows));
}
// Solo se migran intentos abiertos; los cerrados conservan su calificación original.
export function upgradePractice(previous: AnyPracticeState): PracticeState {
  if (isCurrentPractice(previous)) return structuredClone(previous);
  if (previous.version === 4) {
    const s = { ...structuredClone(previous), version: 5 } as PracticeState;
    if (s.current === 4 || s.current === 5) {
      freshExercise(s, s.current);
      s.feedback = 'Las fórmulas ahora se practican en un solo paso. Conservas tus ejercicios completados.';
    }
    return s;
  }
  const s = newPractice(); s.revision = previous.revision; s.savedRows = structuredClone(previous.savedRows); s.savedAt = previous.savedAt;
  const map = LEGACY_TO_CURRENT[previous.version];
  const sourcesOf = (current: number) => map.map((target, i) => target === current ? i : -1).filter(i => i >= 0);
  s.completed = s.completed.map((_, current) => { const sources = sourcesOf(current); return sources.length > 0 && sources.every(i => Boolean(previous.completed[i])); });
  s.visited = s.visited.map((_, current) => sourcesOf(current).some(i => Boolean(previous.visited[i])));
  s.methods = (previous.methods ?? []).map(item => ({ ...item, exercise: map[item.exercise] ?? 0 }));
  const index = Math.min(map[previous.current] ?? 0, EXERCISES.length - 1);
  freshExercise(s, index);
  s.feedback = 'Conservas tu avance anterior.';
  return s;
}

type Sheet = { rows: SheetRow[]; footer: SheetRow };
const rowOf = (sheet: Sheet, id: string) => id === FOOTER_ID ? sheet.footer : sheet.rows.find(item => item.id === id);
// Valor que muestra una celda: el número, el texto o el resultado de su fórmula (o un error como #VALOR!).
export function cellValue(sheet: Sheet, id: string, column: Column, stack: string[] = []): number | string {
  const item = rowOf(sheet, id); if (!item) return '';
  const raw = item[column];
  if (typeof raw !== 'string' || !raw.startsWith('=')) return raw;
  const key = `${id}:${column}`;
  if (stack.includes(key)) return '#REF!';
  let circular = false;
  const read: CellReader = (columnNumber, rowNumber) => {
    const def = COLUMNS[columnNumber - 1]; if (!def) return null;
    if (rowNumber === 1) return def.label;
    const target = rowNumber === sheet.rows.length + 2 ? FOOTER_ID : sheet.rows[rowNumber - 2]?.id;
    if (!target) return null;
    const value = cellValue(sheet, target, def.key, [...stack, key]);
    if (value === '#REF!') circular = true;
    return value === '' ? null : value;
  };
  const result = evaluateFormula(raw, read);
  return circular ? '#REF!' : result.ok ? result.value : '#VALOR!';
}
export const cellText = (sheet: Sheet, id: string, column: Column): string => String(cellValue(sheet, id, column));
const numberOf = (value: number | string) => typeof value === 'number' ? value : 0;
export function visibleRows(state: PracticeState): SheetRow[] {
  const active = Object.entries(state.filters) as [Column, string[]][];
  return state.rows.filter(row => active.every(([column, values]) => values.includes(cellText(state, row.id, column))));
}
// Excel numera por posición en la hoja, aunque haya filas ocultas por el filtro.
export const rowNumber = (state: PracticeState, id: string) => id === FOOTER_ID ? state.rows.length + 2 : state.rows.findIndex(row => row.id === id) + 2;
export const cellAddress = (state: PracticeState, target: Cell) => `${columnDef(target.column).letter}${rowNumber(state, target.row)}`;
export const uniqueValues = (state: PracticeState, column: Column) => [...new Set(state.rows.map(row => cellText(state, row.id, column)))].sort((a, b) => compareValues(a, b, columnDef(column).kind !== 'text'));

export function parseNumber(text: string): number | null {
  const clean = text.trim().replace(/[$\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const value = Number(clean);
  return Number.isFinite(value) && value <= 1e10 ? value : null;
}
const compareValues = (a: string, b: string, numeric: boolean) => numeric ? (Number(a) || 0) - (Number(b) || 0) : a.localeCompare(b, 'es');
const normalized = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const pesos = (value: number | string) => `$${typeof value === 'number' ? value.toLocaleString('es-CO') : value}`;
const sameRows = (a: SheetRow[], b: SheetRow[]) => JSON.stringify(a) === JSON.stringify(b);
const isSorted = (state: PracticeState, column: Column, direction: 'asc' | 'desc') => state.rows.every((row, i) => {
  if (i === 0) return true; const before = numberOf(cellValue(state, state.rows[i - 1]!.id, column)); const now = numberOf(cellValue(state, row.id, column));
  return direction === 'asc' ? before <= now : before >= now;
});
const sameCell = (a: Cell | null | undefined, b: Cell) => a?.row === b.row && a.column === b.column;
const FORMULA_HELP = 'Fórmula no admitida: usa, por ejemplo, =C2-C3 o =SUMA(C2:C4).';

// Convierte lo que escribe el asesor en el valor de la celda: número, fórmula, vacío o texto.
function coerce(def: ColumnDef, text: string): { value: string | number } | { error: string } {
  if (def.kind === 'text') return { value: text };
  const trimmed = text.trim();
  if (trimmed === '') return { value: '' };
  if (trimmed.startsWith('=')) return evaluateFormula(trimmed, () => 0).ok ? { value: normalizeFormula(trimmed) } : { error: FORMULA_HELP };
  const parsed = parseNumber(trimmed);
  return parsed === null ? { error: `${def.label} solo acepta números o fórmulas. Escribe, por ejemplo, 450000.` } : { value: parsed };
}

export function practiceSteps(state: { version: number; completed: boolean[] }) {
  if (state.version === EXCEL_PRACTICE_VERSION || state.version === 4) {
    return EXERCISES.map((exercise, i) => ({ questionId: exercise.id, lesson: exercise.lesson, title: exercise.title, correct: Boolean(state.completed[i]), awardedScore: state.completed[i] ? WEIGHTS[i]! : 0, weight: WEIGHTS[i]!, hint: exercise.hint }));
  }
  const exercises = LEGACY_EXERCISES[state.version as 1 | 2 | 3] ?? LEGACY_EXERCISES[3];
  const weight = 100 / exercises.length;
  return exercises.map((exercise, i) => ({ questionId: exercise.id, lesson: exercise.lesson, title: exercise.title, correct: Boolean(state.completed[i]), awardedScore: state.completed[i] ? weight : 0, weight, hint: 'Resultado de la práctica anterior.' }));
}
export const practiceScore = (state: { version: number; completed: boolean[] }) => Math.round(practiceSteps(state).reduce((sum, step) => sum + step.awardedScore, 0) * 100) / 100;

const MAX_HISTORY = 20;
export function applyPracticeAction(previous: AnyPracticeState, action: PracticeAction, now = new Date()): PracticeState {
  const s = upgradePractice(previous); s.revision++; s.ok = true;
  const exercise = EXERCISES[s.current]!;
  const say = (message: string, ok = true) => { s.feedback = message; s.ok = ok; };
  const row = (id: string) => rowOf(s, id);
  const address = (target: Cell) => cellAddress(s, target);
  const method = (command: string, used: CommandMethod) => { s.methods.push({ exercise: s.current, command, method: used }); if (s.methods.length > 200) s.methods.shift(); };
  const remember = () => { s.history.push({ rows: structuredClone(s.rows), footer: structuredClone(s.footer), filters: structuredClone(s.filters), sort: s.sort }); if (s.history.length > MAX_HISTORY) s.history.shift(); };
  const refreshDirty = () => { s.dirty = !sameRows([...s.rows, s.footer], s.clean); };
  const go = (stage: number, message: string) => { s.stage = stage; say(message); };
  const finish = (message: string) => { s.completed[s.current] = true; say(`${message} Ejercicio completado: +${exercisePoints(s.current).toLocaleString('es-CO')} puntos.`); };
  const set = (target: SheetRow, column: Column, value: string | number) => { (target as Record<Column, string | number>)[column] = value; };

  if (action.type === 'reset') { s.completed[s.current] = false; freshExercise(s, s.current); say('Ejercicio reiniciado: la hoja volvió a su estado inicial.'); return s; }
  if (action.type === 'review') {
    const first = s.completed.findIndex(value => !value);
    if (first < 0) { say(`Completaste los ${EXERCISES.length} ejercicios. Puedes ver tu resultado.`); return s; }
    freshExercise(s, first); return s;
  }
  if (action.type === 'next' || action.type === 'skip') {
    if (action.type === 'next' && !s.completed[s.current]) { say('Completa el ejercicio actual antes de continuar, o déjalo pendiente con 0 puntos.', false); return s; }
    if (s.current >= EXERCISES.length - 1) { say('Este es el último ejercicio. Revisa tu resultado cuando termines.', false); return s; }
    freshExercise(s, s.current + 1); return s;
  }

  // Operaciones de la hoja: siempre actúan sobre los datos, estén o no pedidas por el ejercicio.
  if (action.type === 'edit') {
    const target = row(action.cell.row); const def = columnDef(action.cell.column);
    if (!target) { say('Esa celda no existe en la hoja.', false); return s; }
    const coerced = coerce(def, action.value);
    if ('error' in coerced) { say(coerced.error, false); return s; }
    if (target[action.cell.column] === coerced.value) say(`La celda ${address(action.cell)} no cambió.`);
    else { remember(); set(target, action.cell.column, coerced.value); refreshDirty(); say(`Celda ${address(action.cell)} actualizada.`); }
  } else if (action.type === 'filter') {
    const all = uniqueValues(s, action.column);
    if (action.values && action.values.length === 0) { say('Marca al menos un valor para filtrar.', false); return s; }
    const next = { ...s.filters };
    if (!action.values || all.every(value => action.values!.includes(value))) delete next[action.column]; else next[action.column] = [...action.values].sort();
    if (JSON.stringify(next) !== JSON.stringify(s.filters)) { remember(); s.filters = next; }
    const shown = visibleRows(s).length;
    say(s.filters[action.column] ? `Filtro aplicado: ${shown} de ${s.rows.length} registros.` : 'Filtro quitado: se ven todos los registros.');
  } else if (action.type === 'sort') {
    // Se mueven siempre las filas completas: ningún dato se separa de su cliente.
    const numeric = columnDef(action.column).kind !== 'text'; const factor = action.direction === 'asc' ? 1 : -1;
    const ordered = [...s.rows].sort((a, b) => factor * compareValues(cellText(s, a.id, action.column), cellText(s, b.id, action.column), numeric));
    if (ordered.some((item, i) => item.id !== s.rows[i]!.id) || s.sort?.column !== action.column || s.sort.direction !== action.direction) { remember(); s.rows = ordered; s.sort = { column: action.column, direction: action.direction }; refreshDirty(); }
    say(`Hoja ordenada por ${columnDef(action.column).label}.`);
  } else if (action.type === 'copy') {
    const source = row(action.cell.row);
    if (!source) { say('Esa celda no existe en la hoja.', false); return s; }
    s.clipboard = { cell: action.cell, value: source[action.cell.column] }; method('copy', action.method);
    say(`Copiaste ${address(action.cell)}. El borde punteado marca el origen.`);
  } else if (action.type === 'paste') {
    const target = row(action.cell.row); const def = columnDef(action.cell.column);
    if (!s.clipboard) { say('Todavía no copiaste nada. Selecciona una celda y presiona Ctrl+C.', false); return judge(); }
    if (!target) { say('Esa celda no existe en la hoja.', false); return s; }
    const coerced = coerce(def, String(s.clipboard.value));
    method('paste', action.method);
    if ('error' in coerced) { say(`Ese contenido no se puede pegar en ${address(action.cell)}: ${coerced.error}`, false); return judge(); }
    remember(); set(target, action.cell.column, coerced.value); refreshDirty();
    say(`Pegaste en ${address(action.cell)}.`);
  } else if (action.type === 'undo') {
    method('undo', action.method);
    const last = s.history.pop();
    if (!last) { say('No hay nada que deshacer.', false); return judge(); }
    s.rows = last.rows; s.footer = last.footer; s.filters = last.filters; s.sort = last.sort; s.found = null; refreshDirty();
    say('Deshiciste el último cambio.');
  } else if (action.type === 'open-search') {
    method('search', action.method); say('Escribe lo que buscas en el cuadro Buscar y pulsa Enter.');
  } else if (action.type === 'search') {
    const query = normalized(action.query);
    if (!query) { say('Escribe un nombre en el cuadro Buscar.', false); return s; }
    const matches = [...visibleRows(s), s.footer].flatMap(item => COLUMNS.filter(def => normalized(cellText(s, item.id, def.key)).includes(query)).map(def => ({ row: item.id, column: def.key })));
    // Repetir la misma búsqueda avanza a la siguiente coincidencia, como Buscar siguiente.
    const at = s.query === query && s.found ? matches.findIndex(match => sameCell(s.found, match)) : -1;
    s.query = query; s.found = matches.length ? matches[(at + 1) % matches.length]! : null;
    say(s.found ? `Encontrado en ${address(s.found)}: «${cellText(s, s.found.row, s.found.column)}».` : 'No se encontró ese texto. Revisa la escritura; la tilde es opcional.', Boolean(s.found));
  } else if (action.type === 'save') {
    s.savedRows = structuredClone(s.rows); s.savedAt = now.toISOString(); s.savedExercise = s.current; s.clean = structuredClone([...s.rows, s.footer]); s.dirty = false;
    method('save', action.method); say('Cambios guardados.');
  }
  return judge();

  // Califica el resultado de la operación, no la tecla: cada paso exige el cambio correcto en la hoja.
  function judge(): PracticeState {
    if (s.completed[s.current]) return s;
    const c1 = row('c1')!;
    const edited = (id: string, column: Column) => action.type === 'edit' && action.cell.row === id && action.cell.column === column;
    switch (exercise.id) {
      case 'filtrar': {
        const pending = Object.keys(s.filters).length === 1 && s.filters.estado?.length === 1 && s.filters.estado[0] === 'Pendiente';
        if (s.stage > 0 && !pending) { s.stage = 0; say('Falta el filtro: deja marcado solo «Pendiente» en Estado y pulsa Aceptar.', false); }
        else if (s.stage === 0 && action.type === 'filter') { if (pending) go(1, 'Filtro correcto: solo se ven los clientes Pendiente.'); else say('Deja marcado únicamente «Pendiente» en la lista de Estado y pulsa Aceptar.', false); }
        else if (s.stage === 1 && action.type === 'edit') { if (c1.saldo === 450000) go(2, 'Saldo cambiado a $450.000.'); else say('Cambia el saldo de Camila Rojas (celda C2) a 450000.', false); }
        else if (s.stage === 2 && action.type === 'undo') { if (c1.saldo === 400000) finish('Ctrl+Z restauró el saldo original de $400.000 con el filtro activo.'); else say('Sigue con Ctrl+Z hasta que C2 vuelva a $400.000.', false); }
        else if (s.stage === 2 && c1.saldo !== 450000 && action.type === 'edit') { s.stage = 1; say('Para este paso C2 debe quedar en 450000. Escríbelo otra vez.', false); }
        break;
      }
      case 'ordenar': {
        if (action.type !== 'sort') break;
        const ascending = action.column === 'saldo' && action.direction === 'asc' && isSorted(s, 'saldo', 'asc');
        const descending = action.column === 'saldo' && action.direction === 'desc' && isSorted(s, 'saldo', 'desc');
        if (s.stage === 0) { if (ascending) go(1, 'Saldos de menor a mayor, con cada cliente en su fila.'); else say('Ordena la columna Saldo (C) de menor a mayor.', false); }
        else if (descending) finish('Saldos de mayor a menor, con cada cliente en su fila.');
        else say(ascending ? 'Ya está de menor a mayor. Ahora elige «Ordenar de mayor a menor».' : 'Ordena la columna Saldo (C) de mayor a menor.', false);
        break;
      }
      case 'copiar': {
        const isSource = (item: { cell: Cell; value: string | number } | null) => sameCell(item?.cell, cell('c1', 'cliente')) && item?.value === 'Camila Rojas';
        if (action.type === 'copy') { if (isSource(s.clipboard)) go(1, 'Copiaste A2.'); else { s.stage = 0; say('Copiaste otra celda. Selecciona A2, Camila Rojas, y presiona Ctrl+C.', false); } }
        else if (action.type === 'paste') {
          if (!isSource(s.clipboard)) { s.stage = 0; say('Lo copiado no es A2. Copia A2, Camila Rojas, y vuelve a pegar.', false); }
          else if (s.stage === 0) say('Primero copia A2 con Ctrl+C.', false);
          else if (sameCell(action.cell, cell('c2', 'observacion')) && row('c2')!.observacion === 'Camila Rojas') finish('Pegaste Camila Rojas en F3; el origen A2 se conserva.');
          else say('El destino pedido es F3, la observación de Diego Torres. Deshaz con Ctrl+Z y pega allí.', false);
        }
        break;
      }
      case 'buscar': {
        if (s.stage === 0) { if (action.type === 'open-search') go(1, 'Buscador abierto.'); else if (action.type === 'search') say('Primero abre el buscador con Ctrl+B o el botón Buscar.', false); break; }
        if (action.type !== 'search') break;
        if (s.found?.row === 'c12' && s.found.column === 'cliente') finish('Encontraste a Laura Méndez; su celda quedó resaltada.');
        else if (s.found) say(`Eso es ${cellText(s, s.found.row, s.found.column)}, no Laura Méndez. Escribe su nombre completo.`, false);
        break;
      }
      case 'sumar': {
        // La fórmula debe usar SUMA y dar el total real de los saldos: escribir el número no cuenta.
        const raw = s.footer.saldo; const total = cellValue(s, FOOTER_ID, 'saldo');
        const expected = s.rows.reduce((sum, item) => sum + numberOf(cellValue(s, item.id, 'saldo')), 0);
        const valid = typeof raw === 'string' && /^=(SUMA|SUM)\(C2:C4\)$/.test(normalizeFormula(raw)) && total === expected;
        if (action.type === 'edit') {
          if (!edited(FOOTER_ID, 'saldo')) say('Escribe la fórmula en C5, en la fila «Resultado».', false);
          else if (typeof raw !== 'string' || !raw.startsWith('=')) say('Escribe una fórmula que empiece con =, no el número.', false);
          else if (total === '#REF!') say('No incluyas la celda del resultado. Selecciona solo C2 a C4.', false);
          else if (!isSumFormula(raw)) say('Escribe =SUMA( y selecciona C2 a C4 con el mouse.', false);
          else if (!valid) say('Selecciona los tres saldos, de C2 a C4: =SUMA(C2:C4).', false);
          else finish(`Suma correcta: ${pesos(total)}.`);
        }
        break;
      }
      case 'restar': {
        const raw = s.footer.saldo; const value = cellValue(s, FOOTER_ID, 'saldo');
        const expected = numberOf(cellValue(s, 'c1', 'saldo')) - numberOf(cellValue(s, 'c2', 'saldo'));
        const valid = typeof raw === 'string' && normalizeFormula(raw) === '=C2-C3' && value === expected;
        if (action.type === 'edit') {
          if (!edited(FOOTER_ID, 'saldo')) say('Escribe la fórmula en C5, en la fila «Resultado».', false);
          else if (typeof raw !== 'string' || !raw.startsWith('=')) say('Escribe una fórmula que empiece con =, no el número.', false);
          else if (!valid) say('Selecciona C2, escribe el signo menos (-) y selecciona C3: =C2-C3.', false);
          else finish(`Resta correcta: ${pesos(value)}.`);
        }
        break;
      }
      case 'guardar': {
        const written = c1.observacion.trim().length >= 4;
        if (s.stage === 1 && !written) { s.stage = 0; say('La observación de F2 quedó vacía. Escríbela otra vez y guarda.', false); }
        else if (s.stage === 0 && action.type === 'edit') { if (edited('c1', 'observacion') && written) go(1, 'Observación escrita; el título muestra «Cambios sin guardar».'); else say('Escribe la observación en F2, la celda de Camila Rojas.', false); }
        else if (s.stage === 0 && action.type === 'save') say('Primero escribe una observación en F2 y luego guarda.', false);
        else if (s.stage === 1 && action.type === 'save') finish('Guardaste la observación de Camila Rojas.');
        break;
      }
    }
    return s;
  }
}
