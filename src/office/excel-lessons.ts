import { escapar } from '../http';
import { officeApi, type Lesson } from './api';
import { errorMessage, lessonCard, type OfficeContext } from './office';
import { EXERCISES, EXCEL_PASS_SCORE } from '../../server/domain/excel-practice';
import { createLessonAdvance, type AdvanceState } from './excel-lesson-advance';
import './excel-lessons.css';

type Tool = { id: string; name: string; purpose: string; command: string; icon: string };
const TOOLS: Record<string, Tool[]> = {
  busquedas: [
    { id: 'search', name: 'Buscar', purpose: 'Encuentra un cliente.', command: 'Ctrl + B', icon: 'search' },
    { id: 'filter', name: 'Filtrar', purpose: 'Muestra solo pendientes.', command: 'Datos › Filtro', icon: 'filter' },
  ],
  ordenar: [
    { id: 'asc', name: 'Menor a mayor', purpose: 'El saldo más bajo, primero.', command: 'Datos › Ordenar ↑', icon: 'asc' },
    { id: 'desc', name: 'Mayor a menor', purpose: 'El saldo más alto, primero.', command: 'Datos › Ordenar ↓', icon: 'desc' },
  ],
  formulas: [
    { id: 'sum', name: 'Sumar', purpose: 'Calcula el saldo total.', command: '=SUMA(B2:B4)', icon: 'sum' },
    { id: 'subtract', name: 'Restar', purpose: 'Resta dos valores.', command: '=B2-B3', icon: 'subtract' },
  ],
  atajos: [
    { id: 'copy', name: 'Copiar', purpose: 'Conserva el dato original.', command: 'Ctrl + C', icon: 'copy' },
    { id: 'paste', name: 'Pegar', purpose: 'Lleva la copia a otra celda.', command: 'Ctrl + V', icon: 'paste' },
    { id: 'undo', name: 'Deshacer', purpose: 'Recupera el dato anterior.', command: 'Ctrl + Z', icon: 'undo' },
    { id: 'save', name: 'Guardar', purpose: 'Conserva tus cambios.', command: 'Ctrl + G', icon: 'save' },
  ],
};
const ICONS: Record<string, string> = {
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  asc: '<path d="M7 20V4m-4 4 4-4 4 4m4 2h3m-3 5h5m-5 5h7"/>',
  desc: '<path d="M7 4v16m-4-4 4 4 4-4m4-12h7m-7 5h5m-5 5h3"/>',
  sum: '<path d="M19 4H5l8 8-8 8h14"/>', subtract: '<path d="M5 12h14"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  paste: '<path d="M8 5H4v16h16V5h-4"/><rect x="8" y="3" width="8" height="5" rx="1"/><path d="M8 12h8m-8 4h6"/>',
  undo: '<path d="M4 10h10a6 6 0 0 1 0 12M4 10l5-5m-5 5 5 5"/>',
  save: '<path d="M4 3h13l4 4v14H3V3h1Zm3 0v6h10V3M7 21v-8h10v8"/>',
};
const icon = (name: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ICONS.search}</svg>`;
const money = (value: number) => '$' + value.toLocaleString('es-CO');
const ROWS = [
  { name: 'Camila Rojas', balance: 400000, status: 'Pendiente' },
  { name: 'Andrés Ruiz', balance: 180000, status: 'Acuerdo' },
  { name: 'Luisa Díaz', balance: 650000, status: 'Pendiente' },
];
function previewRows(action: string) {
  const rows = action === 'filter' ? ROWS.filter(row => row.status === 'Pendiente') : [...ROWS];
  if (action === 'asc' || action === 'desc') rows.sort((a, b) => action === 'asc' ? a.balance - b.balance : b.balance - a.balance);
  return rows;
}

// Vista previa didáctica: no captura atajos, no califica y no modifica los datos de la práctica.
function mountPreview(root: HTMLElement, lesson: Lesson, tried: Set<string>, onComplete: () => void): void {
  const tools = TOOLS[lesson.key] ?? [];
  let active = '';
  let copied = false;
  let pasted = false;
  let saved = false;
  let previousOrder = ROWS.map(row => row.name);
  function draw() {
    const formula = lesson.key === 'formulas';
    const shortcuts = lesson.key === 'atajos';
    const rows = previewRows(active);
    const sorting = active === 'asc' || active === 'desc';
    const titles: Record<string, string> = {
      search: 'Cliente encontrado', filter: '3 clientes → 2 pendientes',
      asc: 'Nuevo orden: saldos de menor a mayor', desc: 'Nuevo orden: saldos de mayor a menor',
      sum: 'Resultado de la suma: $1.230.000', subtract: 'Resultado de la resta: $220.000',
      copy: 'C2 copiada: observa el borde punteado', paste: 'C2 → C3: dato pegado',
      undo: 'C3 restaurada: se retiró el dato pegado', save: 'Guardado del ejemplo completado',
    };
    const messages: Record<string, string> = {
      search: 'Camila aparece resaltada. Buscar localiza un dato sin ocultar las otras filas.',
      filter: 'Ves 2 clientes pendientes. El otro cliente sigue en la hoja: no se borra.',
      asc: 'Andrés queda primero: tiene el saldo más bajo. Cada fila conserva sus datos.',
      desc: 'Luisa queda primero: tiene el saldo más alto. Se mueve toda la fila.',
      sum: `Total: ${money(1230000)}. La fórmula suma B2, B3 y B4.`,
      subtract: `${money(400000)} − ${money(180000)} = ${money(220000)}. La fórmula resta B3 de B2.`,
      copy: 'Copiaste la observación de Camila. Ahora toca Pegar para llevarla a C3.',
      paste: 'La observación llegó a C3 y el original sigue en C2.',
      undo: 'Se deshizo el pegado: C3 recuperó su contenido anterior.',
      save: 'Así reconocerás el guardado. En los ejercicios se guardará en tu perfil.',
    };
    const tool = tools.find(item => item.id === active);
    const command = formula && tool ? tool.command
      : shortcuts ? 'C2 · Llamar mañana'
      : active === 'filter' ? 'Estado = Pendiente'
      : active === 'search' ? 'Buscar: Camila'
      : active === 'asc' ? 'Saldo · Menor a mayor ↑'
      : active === 'desc' ? 'Saldo · Mayor a menor ↓'
      : 'Selecciona una herramienta arriba';
    const pending = tools.filter(item => !tried.has(item.id));
    root.innerHTML = `<div class="xl-intro-instruction"><span class="xl-intro-instruction-icon" aria-hidden="true">↘</span><p><strong>Prueba las ${tools.length} herramientas de abajo.</strong><span>Al usarlas todas, la guía avanzará automáticamente.</span></p><span class="xl-intro-tried" role="status" aria-label="${tried.size} de ${tools.length} herramientas probadas">${tried.size} / ${tools.length}</span></div>
    <p class="xl-intro-prompt" role="status">${pending.length ? `Ahora prueba: ${pending.map(item => item.name).join(' · ')}.` : active ? '✓ Herramientas probadas. Observa el resultado.' : 'Ya probaste estas herramientas. Toca una tarjeta para seguir automáticamente.'}</p>
    <div class="xl-intro-tools" role="group" aria-label="Herramientas de ${escapar(lesson.title)}">${tools.map(item => `<button type="button" data-preview-tool="${item.id}" data-tried="${tried.has(item.id)}" aria-pressed="${active === item.id}"${item.id === 'paste' && !copied || item.id === 'undo' && !pasted || item.id === 'save' && !tried.has('undo') ? ' disabled' : ''}>
      <span class="xl-intro-tool-icon">${icon(item.icon)}</span><span><strong>${item.name}</strong><small>${item.purpose}</small><kbd>${item.command}</kbd>${tried.has(item.id) ? '<span class="xl-intro-tool-done">✓ Probado</span>' : ''}</span>
    </button>`).join('')}</div>
    <div class="xl-intro-sheet${active ? ' has-change' : ''}">
      <div class="xl-intro-sheet-top"><span><i aria-hidden="true"></i> Cartera de ejemplo</span><small>Vista previa · Datos ficticios</small></div>
      ${active ? `<div class="xl-intro-feedback" role="status"><span class="xl-intro-change-icon">${icon(tool?.icon ?? 'search')}</span><div><strong>${titles[active]}</strong><p>${messages[active]}</p></div></div>` : ''}
      <div class="xl-intro-formula"><span aria-hidden="true">ƒx</span><code>${escapar(command)}</code></div>
      <div class="xl-intro-table-wrap"><table aria-label="Ejemplo de ${escapar(lesson.title)}"><thead><tr><th scope="col"><span class="xl-intro-column">A</span> Cliente</th><th scope="col" class="${sorting || formula && active ? 'is-key-column' : ''}"><span class="xl-intro-column">B</span> Saldo ${sorting ? active === 'asc' ? '↑' : '↓' : ''}</th>${!formula ? `<th scope="col" class="${active === 'filter' ? 'is-key-column' : ''}"><span class="xl-intro-column">C</span> ${shortcuts ? 'Observación' : 'Estado'}</th>` : ''}</tr></thead><tbody>${rows.map((row, index) => {
        const camila = row.name === 'Camila Rojas';
        const target = row.name === 'Andrés Ruiz';
        const previousPosition = previousOrder.indexOf(row.name) + 2;
        const position = active === 'filter' ? ROWS.indexOf(row) + 2 : index + 2;
        const moved = sorting && previousPosition !== position;
        const balanceSource = active === 'sum' || active === 'subtract' && index < 2;
        const restored = shortcuts && target && active === 'undo';
        const value = shortcuts ? camila || target && pasted ? 'Llamar mañana' : '—' : `<span class="xl-intro-status">${row.status}</span>`;
        const noteClass = shortcuts && camila && copied ? 'is-copied' : shortcuts && target && pasted ? 'is-pasted' : restored ? 'is-restored' : active === 'subtract' && camila ? 'is-source' : '';
        const note = shortcuts && camila && copied ? 'Copiado · C2' : shortcuts && target && pasted ? 'Pegado · C3' : restored ? 'Restaurado · C3' : '';
        return `<tr class="${active === 'search' && camila ? 'is-found' : moved ? 'is-moved' : ''}"><th scope="row"><span class="xl-intro-row-number">${position}</span>${row.name}${active === 'search' && camila ? '<span class="xl-intro-cell-note">✓ Encontrado</span>' : moved ? `<span class="xl-intro-cell-note">Fila ${previousPosition} → ${position}</span>` : ''}</th><td class="${balanceSource ? 'is-source' : sorting ? 'is-sort-key' : ''}">${money(row.balance)}${sorting && index === 0 ? `<span class="xl-intro-cell-note">${active === 'asc' ? 'Menor saldo' : 'Mayor saldo'} · Primero</span>` : ''}</td>${!formula ? `<td class="${noteClass}">${value}${note ? `<span class="xl-intro-cell-note">${note}</span>` : ''}</td>` : ''}</tr>`;
      }).join('')}</tbody>${formula && active ? `<tfoot><tr><th scope="row">5 · Resultado</th><td class="is-result is-changed-cell">${money(active === 'sum' ? 1230000 : 220000)}<span class="xl-intro-cell-note">${active === 'sum' ? 'B2 + B3 + B4' : 'B2 − B3'}</span></td></tr></tfoot>` : ''}</table></div>
      ${active === 'filter' ? '<div class="xl-intro-filter-result"><strong>1 cliente oculto por el filtro</strong><span>Andrés Ruiz · Acuerdo. Sus datos siguen en la hoja.</span></div>' : ''}
      ${shortcuts ? `<div class="xl-intro-save${saved ? ' is-saved' : ''}">${saved ? '✓ Cambios guardados (demostración)' : pasted ? '● Cambios sin guardar (demostración)' : 'Copia de C2 → pega en C3'}</div>` : ''}
    </div>`;
    root.querySelectorAll<HTMLButtonElement>('[data-preview-tool]').forEach(button => button.addEventListener('click', () => {
      if (button.disabled) return;
      previousOrder = previewRows(active).map(row => row.name);
      active = button.dataset.previewTool!;
      if (active === 'copy') copied = true;
      if (active === 'paste') { pasted = true; saved = false; }
      if (active === 'undo') { pasted = false; saved = false; }
      if (active === 'save') saved = true;
      tried.add(active);
      draw();
      const selected = root.querySelector<HTMLButtonElement>(`[data-preview-tool="${active}"]`);
      (selected?.disabled ? root.querySelector<HTMLButtonElement>('[data-preview-tool]:not(:disabled)') : selected)?.focus({ preventScroll: true });
      const sheet = root.querySelector<HTMLElement>('.xl-intro-sheet')!;
      const bounds = sheet.getBoundingClientRect();
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
      if (bounds.top > window.innerHeight * .65 || bounds.bottom < 0) sheet.scrollIntoView({ block: 'center', behavior });
      const wrap = root.querySelector<HTMLElement>('.xl-intro-table-wrap')!;
      const changed = root.querySelector<HTMLElement>('.is-changed-cell') ?? root.querySelector<HTMLElement>('.is-pasted') ?? root.querySelector<HTMLElement>('.is-restored') ?? root.querySelector<HTMLElement>('.is-copied');
      if (changed && wrap.scrollWidth > wrap.clientWidth) wrap.scrollTo({ left: wrap.scrollLeft + changed.getBoundingClientRect().left - wrap.getBoundingClientRect().left - (wrap.clientWidth - changed.offsetWidth) / 2, behavior });
      if (tools.every(item => tried.has(item.id))) onComplete();
    }));
  }
  draw();
}

export function mountExcelLessons(ctx: OfficeContext, lessons: Lesson[], options: { practice: boolean; onComplete: () => Promise<void> }): void {
  if (!lessons.length) return;
  const viewed = new Set(ctx.state.sections.find(item => item.key === 'excel')?.lessonsViewed ?? []);
  let index = options.practice ? Math.max(0, lessons.findIndex(lesson => !viewed.has(lesson.key))) : 0;
  let furthest = index;
  const explored = new Map<string, Set<string>>();
  let panel: HTMLElement | null = null;
  let flow: ReturnType<typeof createLessonAdvance> | undefined;
  let userPaused = false;
  const isCurrent = () => panel !== null && ctx.view.contains(panel);
  const updatePause = () => {
    if (userPaused || document.hidden || panel?.querySelector<HTMLDetailsElement>('.xl-intro-more')?.open) flow?.pause();
    else flow?.resume();
  };
  const observer = new MutationObserver(() => {
    if (!isCurrent()) {
      flow?.cancel(); observer.disconnect(); document.removeEventListener('visibilitychange', updatePause);
    }
  });
  document.addEventListener('visibilitychange', updatePause);
  function draw(focus = false) {
    flow?.cancel();
    const lesson = lessons[index];
    if (!lesson) return;
    userPaused = false;
    const tried = explored.get(lesson.key) ?? new Set<string>();
    explored.set(lesson.key, tried);
    const last = index === lessons.length - 1;
    ctx.view.innerHTML = `<section class="office-card xl-intro" aria-labelledby="xl-intro-title">
      <div class="xl-intro-heading"><div><p class="eyebrow">EXCEL PARA COBRANZAS · GUÍA VISUAL</p><h1 id="xl-intro-title" tabindex="-1">${escapar(lesson.title)}</h1><p>${escapar(lesson.summary)}</p></div><span class="xl-intro-count">${index + 1}<small> / ${lessons.length}</small></span></div>
      <nav class="xl-intro-track" aria-label="Lecciones de Excel">${lessons.map((item, position) => `<button type="button" data-lesson="${position}" ${position === index ? 'aria-current="step"' : ''}${position > furthest ? ' disabled' : ''}><span aria-hidden="true">${viewed.has(item.key) ? '✓' : String(position + 1).padStart(2, '0')}</span><span>${escapar(item.title)}</span></button>`).join('')}</nav>
      <div class="xl-intro-stage"><div class="xl-intro-stage-title"><p class="xl-intro-kicker">MIRA CÓMO FUNCIONA</p><div class="xl-intro-auto" hidden><p role="status" data-auto-status></p><button type="button" data-auto-retry hidden>Reintentar</button></div></div><div data-lesson-preview></div></div>
      <details class="xl-intro-more"><summary>Ver guía completa e ilustración <span aria-hidden="true">＋</span></summary>${lessonCard(lesson)}</details>
      <div class="xl-intro-bottom"><button type="button" class="office-secondary" id="lesson-prev"${index === 0 ? ' disabled' : ''}>← Anterior</button>
      <p class="xl-intro-destination">${last ? `${EXERCISES.length} ejercicios · Apruebas con ${EXCEL_PASS_SCORE}/100 · Reintentos libres` : `Después: ${escapar(lessons[index + 1]!.title)}`}</p></div>
      <dialog class="xl-intro-transition" aria-labelledby="xl-transition-title" aria-describedby="xl-transition-detail xl-transition-reminder">
        <img src="/imagenes/fontana-logo.webp" alt="Fontana" width="68" height="68"><p class="xl-transition-brand">FONTANA SCHOOL</p><span class="xl-transition-ring" aria-hidden="true"></span>
        <h2 id="xl-transition-title" tabindex="-1" autofocus>Te estamos redirigiendo</h2><p id="xl-transition-detail"></p>
        <p id="xl-transition-reminder"><strong>Lee con atención.</strong> Observa cada cambio antes de continuar.</p><small>Tu avance está guardado.</small>
        <button type="button" data-transition-pause>Seguir leyendo esta lección</button>
      </dialog>
    </section>`;
    panel = ctx.view.querySelector<HTMLElement>('.xl-intro')!;
    const mountedPanel = panel;
    const current = () => isCurrent() && panel === mountedPanel;
    const go = (next: number) => { if (!current()) return; index = next; furthest = Math.max(furthest, index); draw(true); };
    const retry = panel.querySelector<HTMLButtonElement>('[data-auto-retry]')!;
    const destination = last ? options.practice ? 'la práctica' : 'el resumen' : lessons[index + 1]!.title;
    const transition = panel.querySelector<HTMLDialogElement>('.xl-intro-transition')!;
    transition.querySelector('#xl-transition-detail')!.textContent = `Siguiente parte: ${destination}.`;
    let transitionCanPause = true;
    const transitionPause = transition.querySelector<HTMLButtonElement>('[data-transition-pause]')!;
    const pauseTransition = () => { if (transitionCanPause) { userPaused = true; updatePause(); } };
    transition.addEventListener('cancel', event => { event.preventDefault(); pauseTransition(); });
    transitionPause.addEventListener('click', pauseTransition);
    const showState = (state: AdvanceState) => {
      if (!current()) return;
      mountedPanel.querySelector<HTMLElement>('.xl-intro-auto')!.hidden = state.phase === 'idle' || state.phase === 'paused';
      const messages: Record<AdvanceState['phase'], string> = {
        idle: 'Interactúa en «Mira cómo funciona» para continuar.',
        saving: '✓ Herramientas probadas. Guardando tu avance…',
        counting: `✓ ¡Listo! Pasarás a ${destination} en ${state.seconds} s.`,
        paused: '',
        redirecting: `Te estamos redirigiendo a ${destination}…`,
        advancing: `Abriendo ${destination}…`,
        error: `No se pudo continuar. ${state.error ? errorMessage(state.error) : 'Intenta de nuevo.'}`,
      };
      mountedPanel.querySelector<HTMLElement>('[data-auto-status]')!.textContent = messages[state.phase];
      retry.hidden = state.phase !== 'error';
      transitionCanPause = state.phase !== 'advancing';
      transitionPause.disabled = !transitionCanPause;
      transitionPause.textContent = transitionCanPause ? 'Seguir leyendo esta lección' : 'Abriendo la siguiente parte…';
      if (state.phase === 'redirecting' || state.phase === 'advancing') {
        if (!transition.open) transition.showModal();
      } else if (transition.open) transition.close();
    };
    flow = createLessonAdvance({
      isCurrent: current,
      save: async () => { await officeApi.view(lesson.key); viewed.add(lesson.key); },
      advance: async () => { if (last) await options.onComplete(); else go(index + 1); },
      state: showState,
    });
    const activeFlow = flow;
    mountPreview(panel.querySelector<HTMLElement>('[data-lesson-preview]')!, lesson, tried, () => { userPaused = false; updatePause(); void activeFlow.start(); });
    panel.querySelector('.xl-intro-more')!.addEventListener('toggle', updatePause);
    retry.addEventListener('click', () => { void activeFlow.start(); });
    ctx.view.querySelectorAll<HTMLButtonElement>('[data-lesson]').forEach(button => button.addEventListener('click', () => { if (!button.disabled && Number(button.dataset.lesson) !== index) go(Number(button.dataset.lesson)); }));
    ctx.view.querySelector('#lesson-prev')!.addEventListener('click', () => { if (index > 0) go(index - 1); });
    if (focus) {
      ctx.view.querySelector<HTMLElement>('#xl-intro-title')?.focus({ preventScroll: true });
      ctx.view.scrollIntoView({ block: 'start' });
    }
  }
  draw();
  observer.observe(document.body, { childList: true, subtree: true });
}
