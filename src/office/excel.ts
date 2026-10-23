import { escapar } from '../http';
import { officeApi, type ExcelPractice, type Lesson } from './api';
import { errorMessage, lessonCard, showError, type OfficeContext } from './office';
import { EXERCISES, EXCEL_EXERCISE_POINTS, practiceScore, practiceSteps, visibleRows, type Cell, type Column, type CommandMethod, type PracticeAction } from '../../server/domain/excel-practice';

export async function renderExcel(ctx: OfficeContext): Promise<void> {
  const info = await officeApi.excelActivity();
  if (info.practice?.status === 'IN_PROGRESS') {
    // Inicializa también los intentos abiertos de la evaluación anterior.
    renderPractice(ctx, info.id, await officeApi.excelStart(info.id));
    return;
  }
  if (info.practice) { renderResult(ctx, info.id, info.practice); return; }
  if (ctx.state.sections.find(item => item.key === 'excel')?.status === 'COMPLETED') {
    ctx.view.innerHTML = `<section class="office-card"><p class="eyebrow">EXCEL PARA COBRANZAS</p><h1>Excel aprobado</h1><p>Tu aprobación anterior se conserva.</p><div class="office-actions"><button class="primary" id="excel-next">Continuar con Ortografía →</button><button class="office-secondary" id="excel-review">Repasar lecciones</button></div></section>`;
    ctx.view.querySelector('#excel-next')!.addEventListener('click', () => ctx.go('ortografia'));
    ctx.view.querySelector('#excel-review')!.addEventListener('click', () => renderLessons(ctx, null, info.lessons));
    return;
  }
  renderLessons(ctx, info.id, info.lessons);
}

function renderLessons(ctx: OfficeContext, id: string | null, lessons: Lesson[]): void {
  const viewed = new Set(ctx.state.sections.find(item => item.key === 'excel')!.lessonsViewed);
  let index = id ? Math.max(0, lessons.findIndex(lesson => !viewed.has(lesson.key))) : 0;
  const draw = () => {
    const lesson = lessons[index]!;
    void officeApi.view(lesson.key).catch(() => undefined);
    ctx.view.innerHTML = `<section class="office-card"><p class="eyebrow">EXCEL PARA COBRANZAS · LECCIÓN ${index + 1} DE ${lessons.length}</p><h1>${escapar(lesson.title)}</h1>${lessonCard(lesson)}
      <p class="office-note">Practicarás ocho comandos en ejercicios individuales. Cada uno vale ${EXCEL_EXERCISE_POINTS.toLocaleString('es-CO')} puntos; apruebas con 80. Puedes corregir sin límite de intentos.</p>
      <div class="office-actions"><button class="office-secondary" id="lesson-prev" ${index === 0 ? 'disabled' : ''}>← Anterior</button><button class="primary" id="lesson-next">${index < lessons.length - 1 ? 'Siguiente lección →' : id ? 'Comenzar los 8 ejercicios →' : 'Volver al resumen'}</button></div></section>`;
    ctx.view.querySelector('#lesson-prev')!.addEventListener('click', () => { index--; draw(); });
    ctx.view.querySelector<HTMLButtonElement>('#lesson-next')!.addEventListener('click', async event => {
      if (index < lessons.length - 1) { index++; draw(); return; }
      if (!id) { await renderExcel(ctx); return; }
      const button = event.currentTarget as HTMLButtonElement; button.disabled = true;
      try { renderPractice(ctx, id, await officeApi.excelStart(id)); }
      catch (error) { button.disabled = false; showError(ctx.view, error); }
    });
  };
  draw();
}

const COLUMNS: { key: Column; letter: string; label: string }[] = [
  { key: 'cliente', letter: 'A', label: 'Cliente' }, { key: 'documento', letter: 'B', label: 'Documento' },
  { key: 'saldo', letter: 'C', label: 'Saldo' }, { key: 'mora', letter: 'D', label: 'Días de mora' },
  { key: 'estado', letter: 'E', label: 'Estado' }, { key: 'observacion', letter: 'F', label: 'Observación' },
];
const same = (a: Cell | null, b: Cell) => a?.row === b.row && a.column === b.column;
const pesos = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);

export function renderPractice(ctx: OfficeContext, id: string, initial: ExcelPractice): void {
  let practice = initial;
  let selected: Cell = { row: 'c1', column: 'cliente' };
  let busy = false;
  let help = false;
  let query = '';
  let filter = practice.state.filter;
  let renderedRoot: HTMLElement | null = null;
  const isHere = () => renderedRoot !== null && ctx.view.contains(renderedRoot);

  async function send(action: PracticeAction): Promise<boolean> {
    if (busy || !isHere()) return false;
    busy = true;
    const feedback = ctx.view.querySelector<HTMLElement>('#excel-feedback')!;
    feedback.textContent = action.type === 'save' ? 'Guardando en tu cuenta…' : 'Validando la acción…';
    ctx.view.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('[data-excel-simulator] button, [data-excel-simulator] input, [data-excel-simulator] select').forEach(el => { el.disabled = true; });
    try {
      const next = await officeApi.excelAction(id, { attemptId: practice.attemptId, revision: practice.state.revision, action });
      if (!isHere()) return false;
      practice = next;
      if (action.type === 'next' || action.type === 'skip' || action.type === 'reset' || action.type === 'review') { selected = { row: 'c1', column: 'cliente' }; filter = practice.state.filter; query = ''; }
      busy = false;
      draw(action.type === 'open-search' ? 'search' : ['next', 'skip', 'reset', 'review'].includes(action.type) ? 'intro' : 'cell');
      return practice.state.ok;
    } catch (error) {
      busy = false;
      if (!isHere()) return false;
      draw('cell');
      const box = ctx.view.querySelector<HTMLElement>('#excel-feedback')!;
      box.dataset.ok = 'false'; box.textContent = errorMessage(error);
      if (action.type === 'save') ctx.view.querySelector<HTMLElement>('#excel-save-state')!.textContent = 'Cambios sin guardar · No se pudo confirmar el guardado. Intenta de nuevo.';
      // Un POST pudo confirmarse aunque su respuesta se perdiera. Recupera la versión del servidor.
      if (error instanceof Error && 'code' in error && error.code === 'PRACTICE_STALE') {
        box.insertAdjacentHTML('beforeend', ' <button type="button" class="office-secondary" id="excel-recover">Recuperar avance</button>');
        box.querySelector('#excel-recover')!.addEventListener('click', () => void ctx.reload());
      }
      return false;
    }
  }
  async function command(type: 'undo' | 'copy' | 'paste' | 'open-search' | 'save', method: CommandMethod) {
    if (busy) return;
    if (type === 'copy' || type === 'paste') await send({ type, cell: selected, method });
    else await send({ type, method });
  }
  function selectCell(cell: Cell) {
    selected = cell;
    ctx.view.querySelectorAll<HTMLElement>('[data-cell-row]').forEach(el => {
      const active = el.dataset.cellRow === cell.row && el.dataset.cellColumn === cell.column;
      el.classList.toggle('is-selected', active); el.setAttribute('aria-pressed', String(active));
    });
    const rowIndex = practice.state.rows.findIndex(row => row.id === cell.row) + 2;
    ctx.view.querySelector<HTMLElement>('#excel-selection')!.textContent = `Celda seleccionada: ${COLUMNS.find(col => col.key === cell.column)!.letter}${rowIndex}`;
  }
  function draw(focus?: 'cell' | 'search' | 'intro') {
    const s = practice.state; const ex = EXERCISES[s.current]!;
    const rows = visibleRows(s); const kind = ex.id;
    ctx.view.innerHTML = `<section class="office-card excel-practice" data-excel-simulator tabindex="0" aria-label="Simulador de práctica de Excel">
      <div class="excel-heading"><div><p class="eyebrow">SIMULADOR DE PRÁCTICA · EJERCICIO ${s.current + 1} DE ${EXERCISES.length}</p><h1 tabindex="-1">${escapar(ex.title)}</h1></div><strong class="excel-score">${practiceScore(s).toLocaleString('es-CO')} / 100 <small>${EXCEL_EXERCISE_POINTS.toLocaleString('es-CO')} puntos por ejercicio</small></strong></div>
      <ol class="excel-milestones" aria-label="Avance de los ocho ejercicios">${EXERCISES.map((item, i) => `<li${i === s.current ? ' aria-current="step"' : ''} aria-label="Ejercicio ${i + 1}: ${escapar(item.title)}. ${s.completed[i] ? 'Completado' : 'Pendiente'}" title="${escapar(item.title)}"><span>${s.completed[i] ? '✓' : i + 1}</span><small>${i === s.current ? 'Estás aquí' : s.completed[i] ? 'Listo' : 'Pendiente'}</small></li>`).join('')}</ol>
      <div class="excel-explanation"><p class="excel-command">Comando a practicar: <kbd>${escapar(ex.command)}</kbd></p><p>${escapar(ex.intro)}</p><p><strong>Ejemplo:</strong> ${escapar(ex.example)}</p><p class="excel-task"><strong>Tu tarea:</strong> ${escapar(ex.task)}</p></div>
      <div class="office-actions excel-utilities"><button class="office-secondary" id="excel-help" aria-expanded="${help}">${help ? 'Ocultar ayuda' : 'Ver ayuda'}</button><button class="office-secondary" id="excel-reset">Reiniciar ejercicio</button></div>
      ${help ? `<p class="excel-help">${escapar(ex.help)}</p>` : ''}
      <p class="office-note">${['filtrar', 'ascendente', 'descendente'].includes(kind) ? 'Usa únicamente el control indicado para este ejercicio.' : 'El atajo funciona solo dentro de la hoja. Si tu navegador lo bloquea, usa el botón equivalente.'}</p>
      <div class="excel-toolbar" aria-label="Comandos del ejercicio">
        ${kind === 'filtrar' ? `<label>Estado <select id="excel-filter" aria-label="Filtrar Estado">${['Todos', 'Pendiente', 'Pagado'].map(value => `<option${filter === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label><button class="office-secondary" id="excel-apply-filter">Aplicar filtro</button>` : ''}
        ${kind === 'deshacer' ? '<button class="office-secondary" data-command="undo">Deshacer <kbd>Ctrl+Z</kbd></button>' : ''}
        ${kind === 'ascendente' ? '<button class="office-secondary" data-sort="asc">Saldo: menor a mayor ↑</button>' : ''}
        ${kind === 'descendente' ? '<button class="office-secondary" data-sort="desc">Saldo: mayor a menor ↓</button>' : ''}
        ${kind === 'copiar' ? '<button class="office-secondary" data-command="copy">Copiar <kbd>Ctrl+C</kbd></button>' : ''}
        ${kind === 'pegar' ? '<button class="office-secondary" data-command="paste">Pegar <kbd>Ctrl+V</kbd></button>' : ''}
        ${kind === 'buscar' ? '<button class="office-secondary" data-command="open-search">Abrir buscador <kbd>Ctrl+B</kbd></button>' : ''}
        ${kind === 'guardar' ? '<button class="primary" data-command="save">Guardar <kbd>Ctrl+G</kbd></button>' : ''}
      </div>
      ${s.searchOpen ? `<form id="excel-search" class="excel-search"><label>Nombre del cliente<input id="excel-query" value="${escapar(query)}" maxlength="100" autocomplete="off"></label><button class="primary" type="submit">Buscar</button></form>` : ''}
      <div class="excel-sheet-scroll" role="region" aria-label="Hoja de cobranza ficticia, desplazamiento horizontal" tabindex="0"><table class="excel-sheet"><caption>Hoja de práctica · Datos ficticios · ${rows.length} de ${s.rows.length} clientes visibles</caption><thead><tr><th scope="col">Fila</th>${COLUMNS.map(col => `<th scope="col"><span>${col.letter}</span>${col.label}</th>`).join('')}</tr></thead><tbody>
      ${rows.map(row => { const rowNum = s.rows.findIndex(item => item.id === row.id) + 2; return `<tr${s.found === row.id ? ' class="excel-found"' : ''}><th scope="row">${rowNum}${s.found === row.id ? '<span class="excel-found-label">Encontrado</span>' : ''}</th>${COLUMNS.map(col => {
        const ref = { row: row.id, column: col.key }; const value = col.key === 'saldo' ? pesos(row.saldo) : String(row[col.key]);
        return `<td><button type="button" data-cell-row="${row.id}" data-cell-column="${col.key}" class="excel-cell${same(selected, ref) ? ' is-selected' : ''}${same(s.clipboard?.cell ?? null, ref) ? ' is-copied' : ''}" aria-pressed="${same(selected, ref)}" aria-label="${col.letter}${rowNum}, ${col.label}: ${escapar(value || 'vacía')}">${escapar(value || '—')}${same(s.clipboard?.cell ?? null, ref) ? '<small>Copiada</small>' : ''}</button></td>`;
      }).join('')}</tr>`; }).join('')}
      </tbody></table></div>
      <p id="excel-selection" class="office-note"></p>
      ${kind === 'guardar' ? `<p id="excel-save-state" class="excel-save-state" role="status">${s.dirty ? 'Cambios sin guardar' : s.savedAt && s.completed[7] ? '✓ Cambios guardados · Recuperables al recargar' : 'Sin cambios nuevos'}</p>` : ''}
      <p class="excel-feedback" id="excel-feedback" data-ok="${s.ok}" role="status" aria-live="polite">${s.ok ? '✓ ' : '↳ '}${escapar(s.feedback)}</p>
      <div class="office-actions excel-navigation">${s.current < EXERCISES.length - 1 ? `<button class="primary" id="excel-continue" ${s.completed[s.current] ? '' : 'disabled'}>Continuar al ejercicio ${s.current + 2} →</button>${!s.completed[s.current] ? '<button class="office-secondary" id="excel-skip">Dejar pendiente (0 puntos) →</button>' : ''}` : '<button class="primary" id="excel-finish">Finalizar y ver resultado</button><button class="office-secondary" id="excel-reinforce">Practicar ejercicios pendientes</button>'}</div>
      <p class="office-note">Apruebas con 80 de 100 puntos. Los errores se pueden corregir sin perder los otros ejercicios. El avance se conserva en tu cuenta.</p>
    </section>`;
    const root = ctx.view.querySelector<HTMLElement>('[data-excel-simulator]')!;
    renderedRoot = root;
    root.querySelector('#excel-help')!.addEventListener('click', () => { help = !help; draw(); rootFocus(); });
    root.querySelector('#excel-reset')!.addEventListener('click', () => void send({ type: 'reset' }));
    root.querySelector('#excel-filter')?.addEventListener('change', event => { filter = (event.target as HTMLSelectElement).value; });
    root.querySelector('#excel-apply-filter')?.addEventListener('click', () => void send({ type: 'filter', value: filter as 'Todos' | 'Pendiente' | 'Pagado' }));
    root.querySelectorAll<HTMLButtonElement>('[data-sort]').forEach(button => button.addEventListener('click', () => void send({ type: 'sort', direction: button.dataset.sort as 'asc' | 'desc' })));
    root.querySelectorAll<HTMLButtonElement>('[data-command]').forEach(button => button.addEventListener('click', () => void command(button.dataset.command as 'undo' | 'copy' | 'paste' | 'open-search' | 'save', 'button')));
    root.querySelectorAll<HTMLButtonElement>('[data-cell-row]').forEach(button => {
      button.addEventListener('focus', () => selectCell({ row: button.dataset.cellRow!, column: button.dataset.cellColumn as Column }));
      button.addEventListener('click', () => selectCell({ row: button.dataset.cellRow!, column: button.dataset.cellColumn as Column }));
    });
    root.querySelector<HTMLInputElement>('#excel-query')?.addEventListener('input', event => { query = (event.target as HTMLInputElement).value; });
    root.querySelector('#excel-search')?.addEventListener('submit', event => { event.preventDefault(); void send({ type: 'search', query }); });
    root.querySelector('#excel-continue')?.addEventListener('click', () => void send({ type: 'next' }));
    root.querySelector('#excel-skip')?.addEventListener('click', () => void send({ type: 'skip' }));
    root.querySelector('#excel-reinforce')?.addEventListener('click', () => void send({ type: 'review' }));
    root.querySelector('#excel-finish')?.addEventListener('click', async () => {
      if (busy) return;
      busy = true; const button = root.querySelector<HTMLButtonElement>('#excel-finish')!; button.disabled = true; button.textContent = 'Guardando resultado…';
      try {
        const result = await officeApi.excelSubmit(id, { attemptId: practice.attemptId, revision: practice.state.revision });
        if (!isHere()) return;
        renderResult(ctx, id, result);
        await ctx.refresh().catch(() => undefined);
      } catch (error) { busy = false; draw(); showError(ctx.view, error); }
    });
    root.addEventListener('keydown', event => {
      if (event.isComposing || event.altKey || event.metaKey) return;
      const target = event.target as HTMLElement;
      const inText = target.matches('input, textarea, [contenteditable="true"]');
      if (event.ctrlKey) {
        const commands = { z: 'undo', c: 'copy', v: 'paste', b: 'open-search', g: 'save' } as const;
        const key = event.key.toLowerCase() as keyof typeof commands;
        const action = commands[key];
        if (!action || inText && ['z', 'c', 'v'].includes(key)) return;
        event.preventDefault(); event.stopPropagation();
        if (!event.repeat && !busy) void command(action, 'shortcut');
        return;
      }
      if (!inText && target.hasAttribute('data-cell-row') && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        const rowIndex = rows.findIndex(row => row.id === selected.row); const colIndex = COLUMNS.findIndex(col => col.key === selected.column);
        const r = Math.max(0, Math.min(rows.length - 1, rowIndex + (event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0)));
        const c = Math.max(0, Math.min(5, colIndex + (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0)));
        root.querySelector<HTMLButtonElement>(`[data-cell-row="${rows[r]!.id}"][data-cell-column="${COLUMNS[c]!.key}"]`)?.focus();
      }
    });
    selectCell(selected);
    if (focus === 'intro') root.querySelector<HTMLElement>('h1')?.focus();
    else if (focus === 'search') root.querySelector<HTMLInputElement>('#excel-query')?.focus();
    else if (focus === 'cell') root.querySelector<HTMLButtonElement>(`[data-cell-row="${selected.row}"][data-cell-column="${selected.column}"]`)?.focus({ preventScroll: true });
  }
  function rootFocus() { ctx.view.querySelector<HTMLElement>('[data-excel-simulator]')?.focus({ preventScroll: true }); }
  draw('intro');
}

function renderResult(ctx: OfficeContext, id: string, practice: ExcelPractice): void {
  const score = practiceScore(practice.state); const passed = practice.status === 'PASSED';
  ctx.view.innerHTML = `<section class="office-card"><p class="eyebrow">EXCEL PARA COBRANZAS · RESULTADO</p><h1 tabindex="-1">${passed ? '¡Práctica aprobada!' : 'Sigue practicando'}</h1><div class="office-metrics"><div><strong>${score} / 100</strong><span>Mínimo de aprobación: 80 puntos</span></div></div>
    <ol class="office-feedback">${practiceSteps(practice.state).map(step => `<li data-ok="${step.correct}"><strong>${step.correct ? '✓ Completado' : '↳ Pendiente de refuerzo'} · ${escapar(step.title)} · ${step.awardedScore.toLocaleString('es-CO')}/${step.weight.toLocaleString('es-CO')}</strong>${!step.correct ? `<span>${escapar(step.hint)}</span>` : ''}</li>`).join('')}</ol>
    <p class="office-note">El resultado, las acciones y la observación guardada se conservan en tu perfil. Se distingue el uso de atajos y botones.</p>
    ${practice.state.savedRows ? `<details class="excel-help"><summary>Ver observación guardada</summary><p>Camila Rojas: ${escapar(practice.state.savedRows.find(row => row.id === 'c1')?.observacion)}</p></details>` : ''}
    <div class="office-actions">${passed ? '<button class="primary" id="excel-next">Continuar con Ortografía →</button>' : '<button class="primary" id="excel-retry">Volver a practicar (sin límite de intentos)</button>'}<button class="office-secondary" id="excel-review">Repasar lecciones</button></div></section>`;
  ctx.view.querySelector('#excel-next')?.addEventListener('click', () => ctx.go('ortografia'));
  ctx.view.querySelector<HTMLButtonElement>('#excel-retry')?.addEventListener('click', async event => {
    const button = event.currentTarget as HTMLButtonElement; button.disabled = true;
    try { renderPractice(ctx, id, await officeApi.excelStart(id)); }
    catch (error) { button.disabled = false; showError(ctx.view, error); }
  });
  ctx.view.querySelector('#excel-review')?.addEventListener('click', async () => {
    try { const info = await officeApi.excelActivity(); renderLessons(ctx, null, info.lessons); }
    catch (error) { showError(ctx.view, error); }
  });
  ctx.view.querySelector<HTMLElement>('h1')?.focus();
}
