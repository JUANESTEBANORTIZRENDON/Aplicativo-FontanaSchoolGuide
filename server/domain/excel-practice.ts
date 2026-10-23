// Cada ejercicio valida un solo comando sobre los datos de la hoja.
export const EXCEL_PRACTICE_VERSION = 2;
export const EXCEL_PASS_SCORE = 80;
export const EXERCISES = [
  { id: 'filtrar', lesson: 'busquedas', title: 'Filtrar pendientes', command: 'Filtro de Estado', task: 'Filtra Estado para mostrar solo clientes pendientes.', intro: 'Un filtro oculta las filas que no necesitas, sin borrarlas.', example: 'Estado: Pendiente → Aplicar filtro.', help: 'En Estado elige Pendiente y pulsa Aplicar filtro. Deben quedar Camila, Laura y Andrés.' },
  { id: 'deshacer', lesson: 'atajos', title: 'Deshacer un cambio', command: 'Ctrl+Z', task: 'Usa Ctrl+Z para recuperar el saldo original de Camila: $400.000.', intro: 'Ya simulamos un error: el saldo de Camila aparece en $450.000. Solo necesitas deshacerlo.', example: 'Selecciona C2 → Ctrl+Z → saldo restaurado.', help: 'Selecciona C2, saldo de Camila, y presiona Ctrl+Z. El cambio equivocado ya está preparado; no debes editar ni filtrar.' },
  { id: 'ascendente', lesson: 'ordenar', title: 'Ordenar de menor a mayor', command: 'Menor a mayor ↑', task: 'Ordena la columna Saldo de menor a mayor.', intro: 'El menor saldo quedará primero. Cada cliente conservará todos sus datos.', example: '$90.000 → $150.000 → $250.000.', help: 'Pulsa Saldo: menor a mayor. Comprueba que Sofía quede primero y Andrés al final.' },
  { id: 'descendente', lesson: 'ordenar', title: 'Ordenar de mayor a menor', command: 'Mayor a menor ↓', task: 'Ordena la columna Saldo de mayor a menor.', intro: 'La hoja ya está ordenada en forma ascendente. Ahora practica únicamente el orden contrario.', example: '$600.000 → $400.000 → $250.000.', help: 'Pulsa Saldo: mayor a menor. Andrés debe quedar primero y Sofía al final.' },
  { id: 'copiar', lesson: 'atajos', title: 'Copiar una celda', command: 'Ctrl+C', task: 'Selecciona A2, Camila Rojas, y usa Ctrl+C.', intro: 'Copiar conserva el contenido original. En este ejercicio solo vas a copiar.', example: 'A2 seleccionada → Ctrl+C → borde punteado.', help: 'Selecciona la celda A2 con el nombre Camila Rojas. Usa Ctrl+C o Copiar. El borde punteado confirmará la copia; no necesitas pegar.' },
  { id: 'pegar', lesson: 'atajos', title: 'Pegar en otra celda', command: 'Ctrl+V', task: 'Selecciona F3, Observación de Diego, y usa Ctrl+V.', intro: 'El nombre Camila Rojas ya está en el portapapeles del simulador. Solo necesitas pegarlo en el destino.', example: 'F3 seleccionada → Ctrl+V → Camila Rojas.', help: 'Selecciona F3, en la columna Observación de Diego, y presiona Ctrl+V. El contenido ya está copiado para este ejercicio independiente.' },
  { id: 'buscar', lesson: 'busquedas', title: 'Buscar un cliente', command: 'Ctrl+B', task: 'Abre el buscador con Ctrl+B y busca Laura Méndez.', intro: 'El buscador localiza un nombre dentro de esta hoja.', example: 'Ctrl+B → Laura Méndez → Buscar.', help: 'Con el foco en la hoja usa Ctrl+B, escribe Laura Méndez y pulsa Buscar o Enter. Su fila debe quedar resaltada.' },
  { id: 'guardar', lesson: 'atajos', title: 'Guardar los cambios', command: 'Ctrl+G', task: 'Usa Ctrl+G para guardar la observación que ya está preparada.', intro: 'La observación de Camila ya fue modificada. Practica únicamente el comando Guardar.', example: 'Cambios sin guardar → Ctrl+G → Cambios guardados.', help: 'Selecciona una celda y usa Ctrl+G. La observación ya está lista en F2. Espera la confirmación del servidor; al recargar se recuperan los datos y el avance.' },
] as const;
export const EXCEL_EXERCISE_POINTS = 100 / EXERCISES.length;
const LEGACY_EXERCISES = [
  { id: 'filtrar', lesson: 'busquedas', title: 'Filtrar y deshacer' },
  { id: 'ordenar', lesson: 'ordenar', title: 'Ordenar saldos' },
  { id: 'copiar', lesson: 'atajos', title: 'Copiar y pegar' },
  { id: 'buscar', lesson: 'busquedas', title: 'Buscar un cliente' },
  { id: 'guardar', lesson: 'atajos', title: 'Guardar una observación' },
];
export type SheetRow = { id: string; cliente: string; documento: string; saldo: number; mora: number; estado: string; observacion: string };
export type Column = 'cliente' | 'documento' | 'saldo' | 'mora' | 'estado' | 'observacion';
export type Cell = { row: string; column: Column };
export type CommandMethod = 'shortcut' | 'button';
export type PracticeAction =
  | { type: 'filter'; value: 'Todos' | 'Pendiente' | 'Pagado' }
  | { type: 'edit'; cell: Cell; value: string }
  | { type: 'undo' | 'open-search' | 'save'; method: CommandMethod }
  | { type: 'sort'; direction: 'asc' | 'desc' }
  | { type: 'copy' | 'paste'; cell: Cell; method: CommandMethod }
  | { type: 'search'; query: string }
  | { type: 'reset' | 'next' | 'skip' | 'review' };
type Undo = { cell: Cell; value: number | string };
export type PracticeState = {
  version: 1 | 2; revision: number; current: number; rows: SheetRow[]; filter: string;
  completed: boolean[]; visited: boolean[]; flags: string[]; undo: Undo | null;
  clipboard: { cell: Cell; value: string | number } | null; found: string | null; searchOpen: boolean;
  dirty: boolean; savedRows: SheetRow[] | null; savedAt: string | null;
  methods: { exercise: number; command: string; method: CommandMethod }[];
  feedback: string; ok: boolean;
};
export function initialRows(): SheetRow[] {
  return [
    { id: 'c1', cliente: 'Camila Rojas', documento: '100000001', saldo: 400000, mora: 35, estado: 'Pendiente', observacion: '' },
    { id: 'c2', cliente: 'Diego Torres', documento: '100000002', saldo: 150000, mora: 0, estado: 'Pagado', observacion: '' },
    { id: 'c3', cliente: 'Laura Méndez', documento: '100000003', saldo: 250000, mora: 18, estado: 'Pendiente', observacion: '' },
    { id: 'c4', cliente: 'Andrés Pérez', documento: '100000004', saldo: 600000, mora: 60, estado: 'Pendiente', observacion: '' },
    { id: 'c5', cliente: 'Sofía Ruiz', documento: '100000005', saldo: 90000, mora: 0, estado: 'Pagado', observacion: '' },
  ];
}
function freshExercise(s: PracticeState, index: number): void {
  s.current = index; s.rows = initialRows(); s.filter = 'Todos'; s.flags = []; s.undo = null;
  s.clipboard = null; s.found = null; s.searchOpen = false; s.dirty = false; s.visited[index] = true;
  const kind = EXERCISES[index]!.id;
  if (kind === 'deshacer') { s.rows[0]!.saldo = 450000; s.undo = { cell: { row: 'c1', column: 'saldo' }, value: 400000 }; }
  if (kind === 'descendente') s.rows.sort((a, b) => a.saldo - b.saldo);
  if (kind === 'pegar') s.clipboard = { cell: { row: 'c1', column: 'cliente' }, value: s.rows[0]!.cliente };
  if (kind === 'guardar') { s.rows[0]!.observacion = 'Cliente solicita llamada mañana.'; s.dirty = true; }
  s.feedback = EXERCISES[index]!.task; s.ok = true;
}
export function newPractice(): PracticeState {
  const s: PracticeState = { version: 2, revision: 0, current: 0, rows: initialRows(), filter: 'Todos', completed: Array(EXERCISES.length).fill(false), visited: Array(EXERCISES.length).fill(false), flags: [], undo: null, clipboard: null, found: null, searchOpen: false, dirty: false, savedRows: null, savedAt: null, methods: [], feedback: '', ok: true };
  freshExercise(s, 0); return s;
}
export function isPractice(value: unknown): value is PracticeState {
  return Boolean(value && typeof value === 'object' && [1, 2].includes((value as PracticeState).version) && Array.isArray((value as PracticeState).rows));
}
// Solo se migran intentos abiertos. Los resultados cerrados siguen mostrando su calificación original.
export function upgradePractice(previous: PracticeState): PracticeState {
  if (previous.version === 2) return structuredClone(previous);
  const groups = [[0, 1], [2, 3], [4, 5], [6], [7]];
  const s = newPractice(); s.revision = previous.revision; s.savedRows = structuredClone(previous.savedRows); s.savedAt = previous.savedAt;
  groups.forEach((indices, i) => { for (const index of indices) { s.completed[index] = Boolean(previous.completed[i]); s.visited[index] = Boolean(previous.visited[i]); } });
  if (previous.current === 0 && previous.flags.includes('filtered')) s.completed[0] = true;
  if (previous.current === 1 && previous.flags.includes('ascending')) s.completed[2] = true;
  if (previous.current === 2 && previous.clipboard?.cell.row === 'c1' && previous.clipboard.cell.column === 'cliente' && previous.clipboard.value === 'Camila Rojas') s.completed[4] = true;
  const currentGroup = groups[previous.current] ?? groups[0]!;
  const index = currentGroup.find(index => !s.completed[index]) ?? currentGroup.at(-1)!;
  s.methods = previous.methods.map(item => ({ ...item, exercise: item.command === 'undo' ? 1 : item.command === 'copy' ? 4 : item.command === 'paste' ? 5 : item.command === 'search' ? 6 : 7 }));
  freshExercise(s, index);
  s.feedback = `Conservas el avance anterior. ${EXERCISES[index]!.task}`;
  return s;
}
export function visibleRows(state: PracticeState): SheetRow[] { return state.rows.filter(row => state.filter === 'Todos' || row.estado === state.filter); }
export function practiceSteps(state: PracticeState) {
  const exercises = state.version === 1 ? LEGACY_EXERCISES : EXERCISES;
  const weight = 100 / exercises.length;
  return exercises.map((exercise, i) => ({ questionId: exercise.id, lesson: exercise.lesson, title: exercise.title, correct: Boolean(state.completed[i]), awardedScore: state.completed[i] ? weight : 0, weight, hint: 'help' in exercise ? exercise.help as string : 'Resultado de la práctica anterior.' }));
}
export const practiceScore = (state: PracticeState) => practiceSteps(state).reduce((sum, step) => sum + step.awardedScore, 0);
const sameCell = (a: Cell, b: Cell) => a.row === b.row && a.column === b.column;
const normalized = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
export function applyPracticeAction(previous: PracticeState, action: PracticeAction, now = new Date()): PracticeState {
  const s = upgradePractice(previous); s.revision++; s.ok = false;
  const kind = EXERCISES[s.current]!.id;
  const fail = (message: string) => { s.feedback = message; return s; };
  const done = (message: string) => { s.feedback = message; s.ok = true; return s; };
  const method = (command: string, used: CommandMethod) => { s.methods.push({ exercise: s.current, command, method: used }); if (s.methods.length > 200) s.methods.shift(); };
  const finish = (message: string) => { s.completed[s.current] = true; return done(`${message} Ejercicio completado: ${EXCEL_EXERCISE_POINTS.toLocaleString('es-CO')} puntos.`); };
  if (action.type === 'reset') { s.completed[s.current] = false; freshExercise(s, s.current); return done(`Ejercicio reiniciado. ${EXERCISES[s.current]!.task}`); }
  if (action.type === 'review') {
    const first = s.completed.findIndex(value => !value);
    if (first < 0) return done('Completaste todos los ejercicios. Puedes finalizar.');
    freshExercise(s, first); return s;
  }
  if (action.type === 'next' || action.type === 'skip') {
    if (action.type === 'next' && !s.completed[s.current]) return fail('Ejecuta el comando indicado antes de continuar, o deja este ejercicio pendiente con 0 puntos.');
    if (s.current >= EXERCISES.length - 1) return fail('Este es el último ejercicio. Revisa tu resultado o finaliza.');
    freshExercise(s, s.current + 1); return s;
  }
  if (s.completed[s.current]) return done('Este ejercicio ya está completo. Continúa o reinícialo para practicar de nuevo.');
  if (action.type === 'filter') {
    if (kind !== 'filtrar') return fail('En este ejercicio practica únicamente el comando indicado.');
    s.filter = action.value;
    const rows = visibleRows(s);
    return action.value === 'Pendiente' && rows.length === 3 && rows.every(row => row.estado === 'Pendiente') ? finish('El filtro muestra solo a Camila, Laura y Andrés.') : fail('Elige Pendiente en Estado y aplica el filtro. Deben quedar tres clientes.');
  }
  if (action.type === 'undo') {
    if (kind !== 'deshacer' || !s.undo) return fail('Deshacer se practica en su propio ejercicio.');
    const before = s.rows.find(row => row.id === s.undo!.cell.row)!;
    const wasWrong = before.saldo === 450000;
    before.saldo = Number(s.undo.value); s.undo = null; method('undo', action.method);
    return wasWrong && before.saldo === 400000 ? finish('Ctrl+Z restauró el saldo original de $400.000.') : fail('Reinicia este ejercicio y usa Deshacer sobre el cambio preparado.');
  }
  if (action.type === 'sort') {
    const direction = kind === 'ascendente' ? 'asc' : kind === 'descendente' ? 'desc' : null;
    if (!direction || action.direction !== direction) return fail('Usa solo el sentido de ordenación indicado en este ejercicio.');
    s.rows.sort((a, b) => direction === 'asc' ? a.saldo - b.saldo : b.saldo - a.saldo);
    const ordered = s.rows.every((row, i, rows) => i === 0 || (direction === 'asc' ? rows[i - 1]!.saldo <= row.saldo : rows[i - 1]!.saldo >= row.saldo));
    const associated = s.rows.every(row => initialRows().some(original => JSON.stringify(original) === JSON.stringify(row)));
    return ordered && associated ? finish(direction === 'asc' ? 'Los saldos quedaron de menor a mayor.' : 'Los saldos quedaron de mayor a menor.') : fail('Ordena la tabla completa, conservando los datos de cada cliente.');
  }
  if (action.type === 'copy') {
    if (kind !== 'copiar') return fail('Copiar se practica en su propio ejercicio. Aquí usa el comando indicado.');
    const row = s.rows.find(row => row.id === action.cell.row);
    if (!row) return fail('Selecciona A2, Camila Rojas.');
    s.clipboard = { cell: action.cell, value: row[action.cell.column] }; method('copy', action.method);
    return sameCell(action.cell, { row: 'c1', column: 'cliente' }) && s.clipboard.value === 'Camila Rojas' ? finish('Copiaste Camila Rojas. El origen se conserva.') : fail('Copiaste otra celda. Selecciona A2 y vuelve a usar Ctrl+C.');
  }
  if (action.type === 'paste') {
    if (kind !== 'pegar') return fail('Pegar se practica en su propio ejercicio.');
    if (!sameCell(action.cell, { row: 'c2', column: 'observacion' })) return fail('Selecciona F3, Observación de Diego, y pega allí.');
    if (!s.clipboard) return fail('Reinicia el ejercicio para recuperar el contenido preparado en el portapapeles.');
    const row = s.rows.find(row => row.id === action.cell.row)!;
    row.observacion = String(s.clipboard.value); method('paste', action.method);
    return row.observacion === 'Camila Rojas' ? finish('Pegaste Camila Rojas en F3.') : fail('El contenido no coincide. Reinicia el ejercicio y vuelve a pegar en F3.');
  }
  if (action.type === 'open-search') {
    if (kind !== 'buscar') return fail('El buscador se practica en su propio ejercicio.');
    s.searchOpen = true; method('search', action.method); return done('Escribe Laura Méndez y pulsa Buscar.');
  }
  if (action.type === 'search') {
    if (kind !== 'buscar' || !s.searchOpen) return fail('Primero abre el buscador con Ctrl+B o su botón equivalente.');
    s.found = s.rows.find(row => normalized(row.cliente) === normalized(action.query))?.id ?? null;
    return s.found === 'c3' ? finish('Encontraste a Laura Méndez.') : fail(s.found ? 'Ese es otro cliente. Busca Laura Méndez.' : 'No se encontró el nombre. Escribe Laura Méndez; puedes omitir la tilde.');
  }
  if (action.type === 'edit') return fail('Los datos necesarios ya están preparados. Practica únicamente el comando indicado.');
  if (action.type === 'save') {
    if (kind !== 'guardar') return fail('Guardar se practica en su propio ejercicio.');
    if (!s.dirty || s.rows[0]?.observacion !== 'Cliente solicita llamada mañana.') return fail('Reinicia el ejercicio para recuperar la observación preparada.');
    s.savedRows = structuredClone(s.rows); s.savedAt = now.toISOString(); s.dirty = false; method('save', action.method);
    return finish('Cambios guardados. Puedes recargar para recuperar la observación.');
  }
  return fail('Usa el comando indicado en este ejercicio.');
}
