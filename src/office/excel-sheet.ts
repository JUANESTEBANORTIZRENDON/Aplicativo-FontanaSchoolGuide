import { escapar } from '../http';
import { decorateTutorFeedback } from '../tutor/feedback';
import { officeApi, type ExcelPractice, type ExcelResult } from './api';
import { errorMessage, type OfficeContext } from './office';
import { showExcelSavingDialog } from './excel-saving-dialog';
import {
  applyPracticeAction, cellAddress, cellValue, COLUMNS as ALL_COLUMNS, columnDef, EXCEL_EXERCISE_POINTS, EXERCISES, exercisePoints, FOOTER_ID, practiceScore, rowNumber, uniqueValues, upgradePractice, visibleRows,
  type Cell, type Column, type CommandMethod, type PracticeAction, type PracticeState,
} from '../../server/domain/excel-practice';
import { referenceSlot, referenceRange, closeSumFormula } from './excel-formula-input';
import './excel-sheet.css';
const COLUMNS = ALL_COLUMNS.filter(col => col.key !== 'abono' && col.key !== 'pendiente');

type Pos = { r: number; c: number };
type Tool = 'undo' | 'copy' | 'paste' | 'search' | 'save';
const ADVANCE_MS = 2400;
const money = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
const sameCell = (a: Cell | null | undefined, b: Cell | null | undefined) => Boolean(a && b && a.row === b.row && a.column === b.column);
// El guardado de savedAt lo decide cada lado con su reloj; el resto del estado debe coincidir.
const sameState = (a: PracticeState, b: PracticeState) => JSON.stringify({ ...a, savedAt: null }) === JSON.stringify({ ...b, savedAt: null });

const TOOLS: { tool: Tool; label: string; keys: string; icon: string; group: string }[] = [
  { tool: 'paste', label: 'Pegar', keys: 'Ctrl+V', icon: '<path d="M8 4h8v3H8zM6 6h2v1h8V6h2v14H6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>', group: 'Portapapeles' },
  { tool: 'copy', label: 'Copiar', keys: 'Ctrl+C', icon: '<path d="M9 8h9v12H9zM6 4h9v3M6 4v12h3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>', group: 'Portapapeles' },
  { tool: 'undo', label: 'Deshacer', keys: 'Ctrl+Z', icon: '<path d="M9 7 5 11l4 4M5 11h8a5 5 0 0 1 0 10h-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>', group: 'Edición' },
  { tool: 'search', label: 'Buscar', keys: 'Ctrl+B', icon: '<circle cx="10.5" cy="10.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m15 15 5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>', group: 'Edición' },
  { tool: 'save', label: 'Guardar', keys: 'Ctrl+G', icon: '<path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>', group: 'Archivo' },
];

export function renderPractice(ctx: OfficeContext, id: string, initial: ExcelPractice, onResult: (result: ExcelResult) => void): void {
  let server = upgradePractice(initial.state);
  let local = structuredClone(server);
  let pos: Pos = { r: 1, c: 0 };
  let edit: { pos: Pos; text: string; from: 'cell' | 'bar' } | null = null;
  let reference: { start: number; end: number; text: string; a: Pos; b: Pos } | undefined;
  let pointing: { base: string; slot: { start: number; end: number }; a: Pos } | undefined;
  let menu: { column: Column; draft: Set<string>; trigger: HTMLElement | null } | null = null;
  let searchOpen = local.current === 3 && local.stage === 1 && !local.completed[3];
  let help = false;
  let note: { text: string; ok: boolean; recover?: boolean } | null = null;
  let reveal = false;
  let finishing = false;
  let moving = false;
  let savingDialog: ReturnType<typeof showExcelSavingDialog> | undefined;
  let pending = 0; let savesInFlight = 0; let generation = 0;
  let chain: Promise<void> = Promise.resolve();
  let advanceTimer: number | undefined;
  let lastCoach = ''; let clearTutor: (() => void) | undefined;
  let lastTask = '';

  ctx.view.innerHTML = `<section class="office-card excel-practice" data-excel-simulator aria-label="Simulador de Excel">
    <div class="xl-head" id="xl-head"></div>
    <div class="xl-task" id="xl-task"></div>
    <div class="xl-window" id="xl-window">
      <div class="xl-titlebar"><span class="xl-logo" aria-hidden="true">X</span><span class="xl-filename">Cobranza_clientes.xlsx</span><span class="xl-savestate" id="xl-savestate" role="status"></span><span class="xl-badge">Simulador de Excel</span></div>
      <div class="xl-tabs" role="tablist" aria-label="Fichas de la cinta"><span role="tab" aria-selected="true" class="is-on">Inicio</span></div>
      <div class="xl-ribbon" id="xl-ribbon" role="toolbar" aria-label="Cinta de herramientas"></div>
      <div class="xl-formulabar"><input id="xl-name" class="xl-namebox" aria-label="Cuadro de nombres: celda activa" autocomplete="off" spellcheck="false"><span class="xl-fx" aria-hidden="true">fx</span><input id="xl-bar" class="xl-bar" aria-label="Barra de fórmulas: contenido de la celda activa" autocomplete="off" spellcheck="false"></div>
      <div class="xl-gridarea">
        <form class="xl-search" id="xl-search" role="search" hidden><label>Buscar <input id="xl-q" type="search" maxlength="100" autocomplete="off" aria-label="Texto que buscas en la hoja"></label><button type="submit" class="xl-mini" data-act="find" aria-label="Buscar siguiente">Buscar</button><button type="button" class="xl-mini" data-act="close-search" aria-label="Cerrar el buscador">✕</button></form>
        <div class="xl-grid" id="xl-grid" role="grid" tabindex="0" aria-label="Hoja Gestión de cobranza. Usa las flechas para moverte y escribe para editar."></div>
      </div>
      <div class="xl-sheettabs"><span class="xl-sheettab" role="tab" aria-selected="true">Gestión de cobranza</span><span class="xl-status" id="xl-status"></span><span class="xl-keys">Ctrl+Z Deshacer · Ctrl+C Copiar · Ctrl+V Pegar · Ctrl+B Buscar · Ctrl+G Guardar</span></div>
    </div>
    <div class="xl-coach" id="xl-coach"></div>
  </section>`;
  const root = ctx.view.querySelector<HTMLElement>('[data-excel-simulator]')!;
  const $ = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const win = $('#xl-window'); const grid = $('#xl-grid'); const bar = $<HTMLInputElement>('#xl-bar'); const nameBox = $<HTMLInputElement>('#xl-name');
  const searchBox = $<HTMLFormElement>('#xl-search'); const queryInput = $<HTMLInputElement>('#xl-q');
  const isHere = () => ctx.view.contains(root);
  const lifecycle = new MutationObserver(() => {
    if (!isHere()) { clearTimeout(advanceTimer); stopPointing(); savingDialog?.close(); clearTutor?.(); document.removeEventListener('pointerdown', outsideMenu, true); lifecycle.disconnect(); }
  });
  lifecycle.observe(document.body, { childList: true, subtree: true });
  // Filas que recorre el cursor: las visibles y, al final, la fila de totales.
  const shown = () => [...visibleRows(local), local.footer];
  const cellOf = (p: Pos): Cell | null => { const row = shown()[p.r - 1]; return p.r > 0 && row ? { row: row.id, column: COLUMNS[p.c]!.key } : null; };
  const posOf = (cell: Cell | null): Pos | null => { const r = shown().findIndex(row => row.id === cell?.row); const c = COLUMNS.findIndex(col => col.key === cell?.column); return r >= 0 && c >= 0 ? { r: r + 1, c } : null; };
  const rawAt = (p: Pos) => { const cell = cellOf(p); const item = cell ? (cell.row === FOOTER_ID ? local.footer : local.rows.find(row => row.id === cell.row)) : null; return p.r === 0 ? COLUMNS[p.c]!.label : cell && item ? String(item[cell.column]) : ''; };
  const exercise = () => EXERCISES[local.current]!;
  const clampPos = () => { pos = { r: Math.max(0, Math.min(shown().length, pos.r)), c: Math.max(0, Math.min(COLUMNS.length - 1, pos.c)) }; };
  const focusGrid = () => grid.focus({ preventScroll: true });
  const say = (text: string, ok = false, recover = false) => { note = { text, ok, recover }; paint(); };

  // ---- Sincronización: la hoja responde al instante y cada acción se repite en el servidor, en orden. ----
  function send(action: PracticeAction) {
    const mine = generation; pending++; if (action.type === 'save') savesInFlight++;
    const task = chain.then(async (): Promise<boolean> => {
      try {
        if (mine !== generation || !isHere()) return false;
        const result = await officeApi.excelAction(id, { attemptId: initial.attemptId, revision: server.revision, action });
        if (mine !== generation || !isHere()) return false;
        server = upgradePractice(result.state);
        if (pending === 1 && !sameState(local, server)) { local = structuredClone(server); clampPos(); }
        else if (pending === 1) local.savedAt = server.savedAt;
        return true;
      } catch (error) {
        if (mine !== generation || !isHere()) return false;
        // La hoja vuelve a la última versión confirmada; nada se muestra como guardado sin confirmación.
        generation++; local = structuredClone(server); clampPos();
        const stale = error instanceof Error && 'code' in error && error.code === 'PRACTICE_STALE';
        note = { text: errorMessage(error), ok: false, recover: stale };
        return false;
      } finally {
        pending--; if (action.type === 'save') savesInFlight--;
        if (isHere()) { paint(); scheduleAdvance(); }
      }
    });
    chain = task.then(() => undefined);
    return task;
  }
  function resetWorkspace() {
    stopPointing(); reference = undefined; pos = { r: 1, c: 0 }; edit = null; menu = null; searchOpen = false; help = false;
    clearTimeout(advanceTimer); advanceTimer = undefined; reveal = true;
  }
  function dispatch(action: PracticeAction) {
    const before = local;
    if (edit) edit = null;
    local = applyPracticeAction(local, action); note = null;
    if (local.current !== before.current || action.type === 'reset') resetWorkspace();
    else if (local.stage !== before.stage) help = false;
    if (action.type === 'search' && local.found) { pos = posOf(local.found) ?? pos; reveal = true; }
    clampPos(); send(action); paint(); scheduleAdvance();
  }
  function scheduleAdvance() {
    if (advanceTimer || moving || finishing || note && !note.ok || !local.completed[local.current] || local.current >= EXERCISES.length - 1 || pending > 0 || !server.completed[server.current]) return;
    advanceTimer = window.setTimeout(() => { advanceTimer = undefined; if (isHere() && !finishing && local.completed[local.current]) void moveExercise('next'); }, ADVANCE_MS);
  }
  async function moveExercise(type: 'next' | 'skip' | 'review') {
    if (moving || finishing || !isHere()) return;
    commitEdit(null); closeMenu(false);
    moving = true; note = null; clearTimeout(advanceTimer); advanceTimer = undefined;
    const mine = generation;
    const target = type === 'review' ? local.completed.findIndex(done => !done) : local.current + 1;
    const destination = EXERCISES[target]?.title ?? 'el siguiente ejercicio';
    let advanced = false;
    savingDialog = showExcelSavingDialog(root, destination);
    paint();
    try {
      await chain;
      if (!isHere() || mine !== generation) return;
      const saved = await send({ type });
      if (!isHere() || !saved) return;
      if (!server.ok) { note = { text: server.feedback, ok: false }; return; }
      resetWorkspace(); paint();
      advanced = true;
      await savingDialog.confirm();
    } finally {
      savingDialog?.close(); savingDialog = undefined; moving = false;
      if (isHere()) {
        paint(); focusGrid(); scheduleAdvance();
        if (advanced) $('#xl-task').scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      }
    }
  }

  // ---- Pintado ----
  function paint(options: { grid?: boolean } = {}) {
    if (!isHere()) return;
    searchBox.hidden = !searchOpen;
    paintHead(); paintTask(); paintRibbon(); paintStatus(); paintCoach();
    if (!edit && options.grid !== false) { paintFormula(); paintGrid(); }
    if (menu) paintMenu();
  }
  function paintHead() {
    const done = local.completed.filter(Boolean).length;
    $('#xl-head').innerHTML = `<div><p class="eyebrow">SIMULADOR DE PRÁCTICA · EXCEL PARA COBRANZAS</p><h1>${escapar(exercise().title)}</h1></div>
      <strong class="xl-score" aria-label="Puntaje ${practiceScore(local)} de 100">${practiceScore(local).toLocaleString('es-CO')} / 100<small>${EXCEL_EXERCISE_POINTS.toLocaleString('es-CO', { maximumFractionDigits: 1 })} puntos por ejercicio · ${done} de ${EXERCISES.length}</small></strong>
      <ol class="xl-steps" aria-label="Avance de los ${EXERCISES.length} ejercicios">${EXERCISES.map((item, i) => `<li class="${i === local.current ? 'is-current' : local.completed[i] ? 'is-done' : ''}"${i === local.current ? ' aria-current="step"' : ''} aria-label="Ejercicio ${i + 1}: ${escapar(item.title)}. ${local.completed[i] ? 'Completado' : i === local.current ? 'En curso' : 'Pendiente'}"><span>${local.completed[i] ? '✓' : i + 1}</span><b>${escapar(item.title)}</b></li>`).join('')}</ol>`;
  }
  function paintTask() {
    const ex = exercise(); const step = ex.steps[local.stage]!; const last = local.current === EXERCISES.length - 1;
    const done = local.completed[local.current]; const all = local.completed.every(Boolean);
    const focus = step.focus;
    const target = focus.kind === 'cell' ? cellAddress(local, focus.cell) : focus.kind === 'menu' ? `Columna ${columnDef(focus.column).label}` : TOOLS.find(item => item.tool === focus.tool)?.keys ?? '';
    const paths = done ? '<path d="m5 12 5 5L20 7"/>' : focus.kind === 'tool' ? TOOLS.find(item => item.tool === focus.tool)?.icon ?? '' : ex.id === 'ordenar' ? '<path d="M7 19V5m-3 3 3-3 3 3m7-3v14m-3-3 3 3 3-3"/>' : ex.id === 'sumar' ? '<path d="M19 4H5l8 8-8 8h14"/>' : ex.id === 'restar' ? '<path d="M5 12h14"/>' : focus.kind === 'menu' ? '<path d="M4 5h16l-6 7v7l-4 2v-9z"/>' : '<path d="M4 4h16v16H4zM4 10h16M10 4v16"/>';
    const taskKey = `${local.current}:${local.stage}:${done}`;
    const task = $('#xl-task');
    const focusedAction = task.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.act : undefined;
    task.classList.toggle('is-new-step', taskKey !== lastTask); lastTask = taskKey;
    task.dataset.done = String(done);
    task.innerHTML = `<div class="xl-task-main"><span class="xl-task-emblem" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg></span>
      <div class="xl-task-text"><div class="xl-task-meta"><span>Ejercicio ${local.current + 1} de ${EXERCISES.length}</span><span class="xl-task-state">${moving || finishing ? 'Guardando resultados…' : done ? pending ? 'Verificando…' : '✓ Completado' : 'Tu misión'}</span>${done ? `<span class="xl-task-location">+${exercisePoints(local.current).toLocaleString('es-CO')} puntos</span>` : `<span class="xl-task-location">${escapar(target)}</span>`}</div>
      <p class="xl-task-line" data-done="${done}">${done ? '¡Lo lograste! Ejercicio completado.' : escapar(step.task)}</p>
      <ol class="xl-task-progress" aria-label="Pasos del ejercicio">${ex.steps.map((entry, index) => `<li class="${done || index < local.stage ? 'is-done' : index === local.stage ? 'is-current' : ''}"${!done && index === local.stage ? ' aria-current="step"' : ''} aria-label="Paso ${index + 1}: ${escapar(entry.task)}. ${done || index < local.stage ? 'Completado' : index === local.stage ? 'Actual' : 'Pendiente'}"><span aria-hidden="true">${done || index < local.stage ? '✓' : index + 1}</span>Paso ${index + 1}</li>`).join('')}</ol>
      ${done ? `<p class="xl-task-sub">${last ? all ? 'Consulta tu resultado cuando estés listo.' : 'Puedes repasar los pendientes antes de finalizar.' : 'El siguiente ejercicio se abrirá automáticamente al guardar tu avance.'}</p>` : ''}</div>
      <div class="xl-task-actions" role="group" aria-label="Opciones del ejercicio">${done
        ? (last ? `<button class="primary" data-act="finish" ${finishing ? 'disabled' : ''}>${finishing ? 'Guardando resultado…' : all ? 'Ver mi resultado' : 'Finalizar y ver resultado'}</button>${all ? '' : '<button class="office-secondary" data-act="review">Practicar pendientes</button>'}` : '<button class="primary" data-act="next">Continuar →</button>')
        : `<button class="office-secondary xl-task-help" data-act="help" aria-expanded="${help}" aria-controls="xl-task-hint"><span aria-hidden="true">?</span> ${help ? 'Ocultar pista' : 'Ver pista'}</button><button class="office-secondary" data-act="reset">Reiniciar ejercicio</button>${last ? '<button class="office-secondary" data-act="finish">Finalizar sin completar este</button>' : '<button class="office-secondary" data-act="skip">Dejar pendiente →</button>'}`}</div></div>
      <div class="xl-task-hint" id="xl-task-hint" role="note"${help && !done ? '' : ' hidden'}><strong>Pista para este paso</strong><p>${escapar(step.help)}</p></div>`;
    if (moving || finishing) task.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = true; });
    if (focusedAction) task.querySelector<HTMLButtonElement>(`[data-act="${focusedAction}"]:not(:disabled)`)?.focus({ preventScroll: true });
  }
  function paintRibbon() {
    const filtered = Object.keys(local.filters).length > 0;
    const groups = [...new Set(TOOLS.map(item => item.group))];
    const disabled = (tool: Tool) => tool === 'undo' ? !local.history.length : tool === 'paste' ? !local.clipboard : false;
    const hint = exerciseHint();
    $('#xl-ribbon').innerHTML = groups.map(group => `<div class="xl-group" role="group" aria-label="${group}"><div class="xl-tools">${TOOLS.filter(item => item.group === group).map(item =>
      `<button type="button" class="xl-tool${hint?.kind === 'tool' && hint.tool === item.tool ? ' xl-hint' : ''}" data-tool="${item.tool}" title="${item.label} (${item.keys})" aria-keyshortcuts="${item.keys}" ${disabled(item.tool) ? 'disabled' : ''}><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${item.icon}</svg><span>${item.label}</span></button>`).join('')}</div><span class="xl-group-name">${group}</span></div>`).join('')
      + `<div class="xl-group" role="group" aria-label="Ordenar y filtrar"><div class="xl-tools"><button type="button" class="xl-tool" data-act="clear-filters" title="Borrar todos los filtros" ${filtered ? '' : 'disabled'}><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 5h16l-6 7v6l-4 2v-8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m16 16 5 5m0-5-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><span>Borrar filtros</span></button></div><span class="xl-group-name">Ordenar y filtrar</span></div>`;
  }
  function paintFormula() {
    const cell = cellOf(pos);
    nameBox.value = pos.r === 0 ? `${COLUMNS[pos.c]!.letter}1` : cell ? cellAddress(local, cell) : '';
    if (document.activeElement !== bar) bar.value = edit ? edit.text : rawAt(pos);
    bar.readOnly = false;
  }
  function paintStatus() {
    const saved = savesInFlight > 0 ? { text: 'Guardando…', tone: 'busy' }
      : local.dirty ? { text: 'Cambios sin guardar', tone: 'dirty' }
        : server.savedAt && server.savedExercise === server.current && !server.dirty && pending === 0 ? { text: 'Guardado', tone: 'saved' } : { text: 'Sin cambios', tone: 'idle' };
    const label = $('#xl-savestate'); label.dataset.tone = saved.tone; label.textContent = saved.text;
    const total = local.rows.length; const count = visibleRows(local).length;
    $('#xl-status').textContent = edit ? 'Modificar' : Object.keys(local.filters).length ? `${count} de ${total} registros encontrados` : 'Listo';
  }
  function paintCoach() {
    const message = note?.text ?? local.feedback; const ok = note ? note.ok : local.ok;
    const tone = !ok ? 'support' : local.completed.every(Boolean) ? 'complete' : local.completed[local.current] ? 'success' : 'guidance';
    const key = `${message}|${ok}|${tone}|${note?.recover}`;
    if (key === lastCoach) return;
    lastCoach = key; clearTutor?.();
    $('#xl-coach').innerHTML = `<p class="xl-feedback" id="xl-feedback" data-ok="${ok}" role="status" aria-live="polite">${!ok ? '↳ ' : local.completed[local.current] && !note ? '✓ ' : ''}${escapar(message)}${note?.recover ? ' <button type="button" class="office-secondary" data-act="recover">Recuperar avance</button>' : ''}</p>`;
    clearTutor = decorateTutorFeedback($('#xl-feedback'), tone);
  }
  function exerciseHint() { return help || !(note ? note.ok : local.ok) ? exercise().steps[local.stage]!.focus : null; }
  function paintGrid() {
    const rows = shown(); const hint = exerciseHint(); const hintCell = hint?.kind === 'cell' ? hint.cell : null;
    const filtered = (column: Column) => Boolean(local.filters[column]);
    const head = (col: (typeof COLUMNS)[number], c: number) => {
      const sortMark = local.sort?.column === col.key ? `<i class="xl-sortmark" aria-hidden="true">${local.sort.direction === 'asc' ? '↑' : '↓'}</i>` : '';
      return `<td role="columnheader" id="xl-r0c${c}" class="xl-cell xl-hdr${pos.r === 0 && pos.c === c ? ' is-active' : ''}" data-r="0" data-c="${c}" aria-selected="${pos.r === 0 && pos.c === c}"><span class="xl-hdr-text">${col.label}${sortMark}</span><button type="button" class="xl-arrow${filtered(col.key) ? ' is-filtered' : ''}${hint?.kind === 'menu' && hint.column === col.key ? ' xl-hint' : ''}" data-menu="${col.key}" aria-haspopup="menu" aria-expanded="${menu?.column === col.key}" aria-label="Filtro y orden de ${col.label}${filtered(col.key) ? ' (filtro activo)' : ''}">${filtered(col.key) ? '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M1 2h10L7 6.5V10L5 11V6.5z" fill="currentColor"/></svg>' : '▾'}</button></td>`;
    };
    const body = rows.map((row, i) => {
      const r = i + 1; const number = rowNumber(local, row.id); const footer = row.id === FOOTER_ID;
      return `<tr role="row"${footer ? ' class="xl-total"' : ''}><th role="rowheader" class="xl-rowhead${pos.r === r ? ' is-active' : ''}${Object.keys(local.filters).length ? ' is-filtered' : ''}" scope="row">${number}</th>${COLUMNS.map((col, c) => {
        const here = { row: row.id, column: col.key }; const active = pos.r === r && pos.c === c;
        const classes = ['xl-cell', col.kind !== 'text' ? 'is-num' : '', active ? 'is-active' : '', reference && r >= Math.min(reference.a.r, reference.b.r) && r <= Math.max(reference.a.r, reference.b.r) && c >= Math.min(reference.a.c, reference.b.c) && c <= Math.max(reference.a.c, reference.b.c) ? 'is-formula-reference' : '', sameCell(local.clipboard?.cell, here) ? 'is-copied' : '', sameCell(local.found, here) ? 'is-found' : '', sameCell(hintCell, here) ? 'xl-hint' : ''].filter(Boolean).join(' ');
        const value = cellValue(local, row.id, col.key); const text = typeof value === 'number' && col.kind === 'money' ? money(value) : String(value);
        const content = edit?.from === 'cell' && edit.pos.r === r && edit.pos.c === c ? `<input class="xl-editor" value="${escapar(edit.text)}" aria-label="Editando ${col.letter}${number}" autocomplete="off" spellcheck="false">` : escapar(text);
        return `<td role="gridcell" id="xl-r${r}c${c}" class="${classes}" data-r="${r}" data-c="${c}" aria-selected="${active}">${content}</td>`;
      }).join('')}</tr>`;
    }).join('');
    grid.innerHTML = `<table class="xl-table" role="presentation"><colgroup><col style="width:46px">${COLUMNS.map(col => `<col style="width:${col.width}px">`).join('')}</colgroup>
      <thead><tr role="row"><th class="xl-corner" aria-hidden="true"></th>${COLUMNS.map((col, c) => `<th role="presentation" class="xl-colhead${pos.c === c ? ' is-active' : ''}" scope="col">${col.letter}</th>`).join('')}</tr></thead>
      <tbody><tr role="row" class="xl-first"><th role="rowheader" class="xl-rowhead${pos.r === 0 ? ' is-active' : ''}" scope="row">1</th>${COLUMNS.map(head).join('')}</tr>${body}</tbody></table>`;
    grid.setAttribute('aria-activedescendant', `xl-r${pos.r}c${pos.c}`);
    if (edit?.from === 'cell') { const input = grid.querySelector<HTMLInputElement>('.xl-editor'); input?.focus({ preventScroll: true }); input?.setSelectionRange(input.value.length, input.value.length); }
    if (reveal) { reveal = false; ensureVisible(); }
  }
  function ensureVisible() {
    const td = grid.querySelector<HTMLElement>(`#xl-r${pos.r}c${pos.c}`); if (!td) return;
    const g = grid.getBoundingClientRect(); const t = td.getBoundingClientRect();
    const top = g.top + 24 + 28; const left = g.left + 46;
    if (t.top < top) grid.scrollTop -= top - t.top; else if (t.bottom > g.bottom - 16) grid.scrollTop += t.bottom - g.bottom + 16;
    if (t.left < left) grid.scrollLeft -= left - t.left; else if (t.right > g.right) grid.scrollLeft += t.right - g.right;
  }

  // ---- Menú de encabezado: ordenar y filtrar, como la flecha del autofiltro ----
  function openMenu(column: Column, trigger: HTMLElement) {
    commitEdit(null);
    menu = { column, draft: new Set(local.filters[column] ?? uniqueValues(local, column)), trigger };
    paintMenu();
    root.querySelector<HTMLElement>('.xl-menu [role="menuitem"]')?.focus();
    document.addEventListener('pointerdown', outsideMenu, true);
  }
  function closeMenu(restore = true) {
    if (!menu) return;
    const column = menu.column; menu = null; win.querySelector('.xl-menu')?.remove();
    document.removeEventListener('pointerdown', outsideMenu, true);
    if (isHere()) { paintGridKeepScroll(); if (restore) (root.querySelector<HTMLElement>(`.xl-arrow[data-menu="${column}"]`) ?? grid).focus({ preventScroll: true }); }
  }
  function outsideMenu(event: Event) { if (!isHere()) { document.removeEventListener('pointerdown', outsideMenu, true); return; } if (!(event.target as HTMLElement).closest('.xl-menu, .xl-arrow')) closeMenu(false); }
  function paintGridKeepScroll() { const top = grid.scrollTop; const left = grid.scrollLeft; paintGrid(); grid.scrollTop = top; grid.scrollLeft = left; }
  function paintMenu() {
    if (!menu) return;
    menu.trigger = root.querySelector<HTMLElement>(`.xl-arrow[data-menu="${menu.column}"]`);
    const def = columnDef(menu.column); const values = uniqueValues(local, menu.column); const numeric = def.kind !== 'text';
    win.querySelector('.xl-menu')?.remove();
    const w = win.getBoundingClientRect(); const b = menu.trigger?.getBoundingClientRect();
    const left = b ? Math.max(4, Math.min(w.width - 264, b.right - w.left - 250)) : 8; const top = b ? b.bottom - w.top + 2 : 80;
    const all = values.every(value => menu!.draft.has(value));
    win.insertAdjacentHTML('beforeend', `<div class="xl-menu" role="menu" aria-label="Opciones de ${escapar(def.label)}" style="left:${left}px;top:${top}px">
      <button type="button" role="menuitem" data-sort="asc"><span aria-hidden="true">↑</span>${numeric ? 'Ordenar de menor a mayor' : 'Ordenar de A a Z'}</button>
      <button type="button" role="menuitem" data-sort="desc"><span aria-hidden="true">↓</span>${numeric ? 'Ordenar de mayor a menor' : 'Ordenar de Z a A'}</button>
      <hr><button type="button" role="menuitem" data-menu-clear ${local.filters[menu.column] ? '' : 'disabled'}>Borrar filtro de «${escapar(def.label)}»</button><hr>
      <div class="xl-list" role="group" aria-label="Valores de ${escapar(def.label)}"><label><input type="checkbox" data-all ${all ? 'checked' : ''}> (Seleccionar todo)</label>${values.map(value => `<label><input type="checkbox" data-value="${escapar(value)}" ${menu!.draft.has(value) ? 'checked' : ''}> ${escapar(def.kind === 'money' && value !== '' && Number.isFinite(Number(value)) ? money(Number(value)) : value || '(vacías)')}</label>`).join('')}</div>
      <div class="xl-menu-actions"><button type="button" class="xl-ok" data-menu-ok ${menu.draft.size ? '' : 'disabled'}>Aceptar</button><button type="button" class="xl-cancel" data-menu-cancel>Cancelar</button></div></div>`);
    const allBox = win.querySelector<HTMLInputElement>('[data-all]')!; allBox.indeterminate = !all && menu.draft.size > 0;
  }

  // ---- Edición ----
  function startEdit(initialText: string | null, from: 'cell' | 'bar' = 'cell') {
    if (edit) return;
    if (pos.r === 0) { say('Los encabezados no se editan en esta práctica. Selecciona una celda con datos.'); return; }
    edit = { pos: { ...pos }, text: initialText ?? rawAt(pos), from };
    paintGrid(); paintStatus(); bar.value = edit.text;
  }
  function commitEdit(move: 'down' | 'right' | 'left' | 'up' | null) {
    const current = edit; if (!current) return;
    stopPointing(); reference = undefined; edit = null;
    current.text = closeSumFormula(current.text);
    const cell = cellOf(current.pos);
    if (move === 'down') pos = { r: Math.min(shown().length, current.pos.r + 1), c: current.pos.c };
    else if (move === 'up') pos = { r: Math.max(0, current.pos.r - 1), c: current.pos.c };
    else if (move === 'right') pos = { r: current.pos.r, c: Math.min(COLUMNS.length - 1, current.pos.c + 1) };
    else if (move === 'left') pos = { r: current.pos.r, c: Math.max(0, current.pos.c - 1) };
    else pos = current.pos;
    reveal = true;
    if (cell && current.text !== rawAt(current.pos)) dispatch({ type: 'edit', cell, value: current.text }); else paint();
    focusGrid();
  }
  function cancelEdit() { if (!edit) return; stopPointing(); reference = undefined; edit = null; paint(); focusGrid(); }

  // Pointing keeps the destination in edit mode while the mouse selects source cells.
  function stopPointing() {
    pointing = undefined;
    document.removeEventListener('mousemove', pointMove);
    document.removeEventListener('mouseup', stopPointing);
  }
  function pointTo(b: Pos) {
    if (!pointing || !edit || b.r === 0) return;
    const { base, slot, a } = pointing;
    const value = referenceRange(a, b);
    edit.text = base.slice(0, slot.start) + value + base.slice(slot.end);
    reference = { start: slot.start, end: slot.start + value.length, text: edit.text, a, b };
    bar.value = edit.text; paintGridKeepScroll();
    const input = edit.from === 'bar' ? bar : grid.querySelector<HTMLInputElement>('.xl-editor');
    input?.focus({ preventScroll: true }); input?.setSelectionRange(reference.end, reference.end);
  }
  function pointMove(event: MouseEvent) {
    if (!pointing) return;
    if (!(event.buttons & 1)) { stopPointing(); return; }
    const td = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('td.xl-cell');
    if (td && grid.contains(td)) {
      const b = { r: Number(td.dataset.r), c: Number(td.dataset.c) };
      if (!reference || b.r !== reference.b.r || b.c !== reference.b.c) pointTo(b);
    }
  }
  function beginPointing(target: Pos) {
    if (!edit || target.r === 0) return false;
    const input = edit.from === 'bar' ? bar : grid.querySelector<HTMLInputElement>('.xl-editor');
    const slot = referenceSlot(edit.text, input?.selectionStart ?? edit.text.length, input?.selectionEnd ?? edit.text.length, reference);
    if (!slot) return false;
    pointing = { base: edit.text, slot, a: target }; pointTo(target);
    document.addEventListener('mousemove', pointMove); document.addEventListener('mouseup', stopPointing);
    return true;
  }

  // ---- Comandos: los atajos y los botones de la cinta ejecutan la misma operación ----
  function run(tool: Tool, method: CommandMethod) {
    commitEdit(null);
    if (tool === 'undo') dispatch({ type: 'undo', method });
    else if (tool === 'save') dispatch({ type: 'save', method });
    else if (tool === 'search') openSearch(method);
    else {
      const cell = cellOf(pos);
      if (!cell) { say('Selecciona una celda con datos (no el encabezado).'); return; }
      dispatch({ type: tool, cell, method });
    }
    if (tool !== 'search') focusGrid();
  }
  function openSearch(method: CommandMethod) {
    const wasOpen = searchOpen; searchOpen = true; searchBox.hidden = false;
    if (!wasOpen) dispatch({ type: 'open-search', method });
    queryInput.focus(); queryInput.select();
  }
  function closeSearch() { searchOpen = false; searchBox.hidden = true; focusGrid(); }
  function move(dr: number, dc: number) { pos = { r: pos.r + dr, c: pos.c + dc }; clampPos(); reveal = true; paint(); }

  async function finish() {
    if (finishing || moving || !isHere()) return;
    commitEdit(null); closeMenu(false); finishing = true; paint(); clearTimeout(advanceTimer); advanceTimer = undefined;
    const mine = generation;
    savingDialog = showExcelSavingDialog(root, 'tu resultado de la práctica');
    try {
      await chain;
      if (!isHere() || mine !== generation) return;
      const result = await officeApi.excelSubmit(id, { attemptId: initial.attemptId, revision: server.revision });
      if (!isHere()) return;
      await savingDialog.confirm();
      if (!isHere()) return;
      savingDialog.close(); savingDialog = undefined;
      onResult(result); await ctx.refresh().catch(() => undefined);
    } catch (error) { if (isHere()) say(errorMessage(error)); }
    finally { savingDialog?.close(); savingDialog = undefined; finishing = false; if (isHere()) { paint(); focusGrid(); } }
  }

  // ---- Eventos (delegados): solo se atienden los que ocurren dentro del simulador ----
  root.addEventListener('mousedown', event => {
    if (moving || finishing) return;
    const td = (event.target as HTMLElement).closest<HTMLElement>('td.xl-cell');
    if (!td || (event.target as HTMLElement).closest('.xl-arrow, .xl-editor')) return;
    event.preventDefault();
    if (beginPointing({ r: Number(td.dataset.r), c: Number(td.dataset.c) })) return;
    commitEdit(null); if (menu) closeMenu(false);
    pos = { r: Number(td.dataset.r), c: Number(td.dataset.c) }; clampPos(); paint(); focusGrid();
  });
  root.addEventListener('dblclick', event => { if (!moving && !finishing && (event.target as HTMLElement).closest('td.xl-cell:not(.xl-hdr)') && !edit) startEdit(null); });
  root.addEventListener('click', event => {
    if (moving || finishing) return;
    const el = event.target as HTMLElement;
    const tool = el.closest<HTMLElement>('[data-tool]'); const act = el.closest<HTMLElement>('[data-act]')?.dataset.act;
    const arrow = el.closest<HTMLElement>('.xl-arrow');
    if (tool) { run(tool.dataset.tool as Tool, 'button'); return; }
    if (arrow) { const column = arrow.dataset.menu as Column; if (menu?.column === column) closeMenu(); else { commitEdit(null); pos = { r: 0, c: COLUMNS.findIndex(col => col.key === column) }; paint(); openMenu(column, root.querySelector<HTMLElement>(`.xl-arrow[data-menu="${column}"]`)!); } return; }
    const sort = el.closest<HTMLElement>('[data-sort]');
    if (sort && menu) { const column = menu.column; closeMenu(false); dispatch({ type: 'sort', column, direction: sort.dataset.sort as 'asc' | 'desc' }); focusGrid(); return; }
    if (el.closest('[data-menu-clear]') && menu) { const column = menu.column; closeMenu(false); dispatch({ type: 'filter', column, values: null }); focusGrid(); return; }
    if (el.closest('[data-menu-ok]') && menu) { const { column, draft } = menu; closeMenu(false); dispatch({ type: 'filter', column, values: [...draft] }); focusGrid(); return; }
    if (el.closest('[data-menu-cancel]')) { closeMenu(); return; }
    if (!act) return;
    if (act === 'help') { help = !help; paint(); root.querySelector<HTMLButtonElement>('[data-act="help"]')?.focus({ preventScroll: true }); }
    else if (act === 'reset') { dispatch({ type: 'reset' }); focusGrid(); }
    else if (act === 'skip') void moveExercise('skip');
    else if (act === 'next') void moveExercise('next');
    else if (act === 'review') void moveExercise('review');
    else if (act === 'finish') void finish();
    else if (act === 'clear-filters') { commitEdit(null); for (const column of Object.keys(local.filters) as Column[]) dispatch({ type: 'filter', column, values: null }); focusGrid(); }
    else if (act === 'close-search') closeSearch();
    else if (act === 'recover') void ctx.reload();
  });
  root.addEventListener('change', event => {
    const box = event.target as HTMLInputElement;
    if (!menu || !box.matches('.xl-list input')) return;
    const values = uniqueValues(local, menu.column);
    if (box.hasAttribute('data-all')) menu.draft = new Set(box.checked ? values : []);
    else if (box.checked) menu.draft.add(box.dataset.value!); else menu.draft.delete(box.dataset.value!);
    paintMenu(); root.querySelector<HTMLInputElement>(box.hasAttribute('data-all') ? '[data-all]' : `[data-value="${CSS.escape(box.dataset.value!)}"]`)?.focus();
  });
  root.addEventListener('input', event => {
    const el = event.target as HTMLInputElement;
    if (el === bar || el.classList.contains('xl-editor')) { reference = undefined; grid.querySelectorAll('.is-formula-reference').forEach(cell => cell.classList.remove('is-formula-reference')); }
    if (el.classList.contains('xl-editor') && edit) { edit.text = el.value; bar.value = el.value; }
    else if (el === bar) { if (!edit && pos.r > 0) edit = { pos: { ...pos }, text: el.value, from: 'bar' }; else if (edit) edit.text = el.value; paintStatus(); }
  });
  searchBox.addEventListener('submit', event => { event.preventDefault(); dispatch({ type: 'search', query: queryInput.value }); queryInput.focus(); });
  nameBox.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const match = /^([A-F])(\d{1,2})$/i.exec(nameBox.value.trim());
    const c = match ? COLUMNS.findIndex(col => col.letter === match[1]!.toUpperCase()) : -1; const r = match ? Number(match[2]) - 1 : -1;
    const target = r === 0 ? { r: 0, c } : posOf(r >= 1 ? { row: r - 1 === local.rows.length ? FOOTER_ID : local.rows[r - 1]?.id ?? '', column: COLUMNS[c]?.key ?? 'cliente' } : null);
    if (c < 0 || !target) { say('Esa celda no existe o está oculta por un filtro. Prueba con una como C2.'); paintFormula(); return; }
    pos = target; reveal = true; paint(); focusGrid();
  });
  root.addEventListener('keydown', event => {
    if (moving || finishing) return;
    if (event.isComposing || event.altKey) return;
    const target = event.target as HTMLElement; const key = event.key; const lower = key.toLowerCase();
    const mod = event.ctrlKey || event.metaKey;
    const inEditor = target.classList.contains('xl-editor'); const inBar = target === bar; const inName = target === nameBox; const inSearch = target === queryInput;
    const inMenu = Boolean(target.closest('.xl-menu'));
    if (inMenu) {
      if (key === 'Escape') { event.preventDefault(); closeMenu(); }
      else if (key === 'ArrowDown' || key === 'ArrowUp') {
        const items = [...root.querySelectorAll<HTMLElement>('.xl-menu button:not(:disabled), .xl-menu input')]; const at = items.indexOf(target);
        if (at >= 0) { event.preventDefault(); items[(at + (key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]!.focus(); }
      }
      return;
    }
    if (inName) return;
    // Ctrl+B y Ctrl+G son convenciones de esta práctica en español; se interceptan para que el navegador no actúe.
    if (mod && (lower === 'b' || lower === 'g')) {
      event.preventDefault(); event.stopPropagation();
      if (event.repeat) return;
      if (lower === 'b') { if (inEditor || inBar) commitEdit(null); run('search', 'shortcut'); } else run('save', 'shortcut');
      return;
    }
    if (inSearch) {
      if (key === 'Escape') { event.preventDefault(); closeSearch(); }
      else if (key === 'Enter') { event.preventDefault(); dispatch({ type: 'search', query: queryInput.value }); queryInput.focus(); }
      return;
    }
    if (inEditor || inBar) {
      if (mod) return; // Ctrl+Z/C/V/A actúan sobre el texto que escribes
      if (key === 'Enter') { event.preventDefault(); commitEdit('down'); }
      else if (key === 'Tab') { event.preventDefault(); commitEdit(event.shiftKey ? 'left' : 'right'); }
      else if (key === 'Escape') { event.preventDefault(); cancelEdit(); }
      else if (inEditor && (key === 'ArrowDown' || key === 'ArrowUp')) { event.preventDefault(); commitEdit(key === 'ArrowDown' ? 'down' : 'up'); }
      return;
    }
    if (mod && ['z', 'c', 'v'].includes(lower)) {
      event.preventDefault(); event.stopPropagation();
      if (!event.repeat) run(lower === 'z' ? 'undo' : lower === 'c' ? 'copy' : 'paste', 'shortcut');
      return;
    }
    if (target !== grid || mod) return;
    const last = shown().length;
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') { event.preventDefault(); move(key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0, key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0); }
    else if (key === 'Enter') { event.preventDefault(); move(event.shiftKey ? -1 : 1, 0); }
    else if (key === 'Tab') {
      const atEnd = event.shiftKey ? pos.r === 0 && pos.c === 0 : pos.r === last && pos.c === COLUMNS.length - 1;
      if (atEnd) return; // sin trampa de teclado: en los extremos Tab sale de la hoja
      event.preventDefault();
      if (event.shiftKey) { if (pos.c === 0) { pos = { r: pos.r - 1, c: COLUMNS.length - 1 }; reveal = true; paint(); } else move(0, -1); }
      else if (pos.c === COLUMNS.length - 1) { pos = { r: pos.r + 1, c: 0 }; reveal = true; paint(); } else move(0, 1);
    }
    else if (key === 'Home') { event.preventDefault(); pos = { r: pos.r, c: 0 }; reveal = true; paint(); }
    else if (key === 'End') { event.preventDefault(); pos = { r: pos.r, c: COLUMNS.length - 1 }; reveal = true; paint(); }
    else if (key === 'PageDown' || key === 'PageUp') { event.preventDefault(); move(key === 'PageDown' ? 8 : -8, 0); }
    else if (key === 'F2') { event.preventDefault(); startEdit(null); }
    else if (key === 'Delete' || key === 'Backspace') { event.preventDefault(); const cell = cellOf(pos); if (cell) dispatch({ type: 'edit', cell, value: '' }); }
    else if (key === 'Escape') { if (note) { note = null; paint(); } }
    else if (key.length === 1) { event.preventDefault(); startEdit(key); }
  });
  bar.addEventListener('focus', () => { if (!edit && pos.r > 0) { edit = { pos: { ...pos }, text: rawAt(pos), from: 'bar' }; paintStatus(); } });

  // La hoja recibe el foco al abrir cada ejercicio para que los atajos funcionen sin hacer clic.
  searchBox.hidden = !searchOpen;
  paint(); focusGrid(); scheduleAdvance();
}
