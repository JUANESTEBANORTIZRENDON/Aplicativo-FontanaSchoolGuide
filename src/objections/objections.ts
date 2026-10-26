import '../collections/collections.css';
import './objections-expert.css';
import { progressGuide } from '../progress-guide';
import { api, escapar } from '../http';
import { playSeal, stampSvg } from '../seal-animation';
import { bindReactivation, reactivationNotice } from '../reactivation';
import { OBJECTIONS_MAX_TEXT, type ObjectionCaseGrade } from '../../server/domain/objections-expert';
import type { AdvisorObjectionsResult } from '../../server/domain/advisor-results';
import type { objectionsState } from '../../server/services/objections.service';
import { showExcelSavingDialog } from '../office/excel-saving-dialog';
import { actionVisual, caseIllustration, caseSlideCopy } from './case-visuals';

type FullState = Awaited<ReturnType<typeof objectionsState>>;
type State = Omit<FullState, 'exam'> & { exam: Omit<FullState['exam'], 'result'> & { result: AdvisorObjectionsResult | null } };
type Mode = 'intro' | 'exam' | 'result' | 'practice';
const BASE = '/training/objections';

export async function mountObjections(container: HTMLElement, backHref: string): Promise<void> {
  container.innerHTML = '<p role="status">Preparando tus cinco casos…</p>';
  let state!: State;
  let mode: Mode = 'intro';
  let index = 0;
  let busy = false;
  let error = '';
  let answers: Record<string, string> = {};
  let saved: Record<string, string> = {};
  let practiceText = '';
  let practiceResult: ObjectionCaseGrade | null = null;
  let confirming = false;

  try {
    await load();
    mode = state.exam.draft ? 'exam' : state.exam.result ? 'result' : 'intro';
    index = 0;
    render();
  } catch (cause) {
    container.innerHTML = `<section class="auth-card"><h2>No pudimos abrir el módulo</h2><p role="alert">${escapar((cause as Error).message)}</p><a href="${escapar(backHref)}">Volver a tu ruta</a></section>`;
    return;
  }
  async function load(): Promise<void> {
    state = (await api<{ data: State }>(`${BASE}/module`)).data;
    answers = { ...state.exam.draft?.answers }; saved = { ...answers };
  }
  // Las respuestas viven solo en pantalla hasta el envío final; avisamos si se intenta salir con texto sin enviar.
  function dirty(): boolean { return Object.entries(answers).some(([k, v]) => v !== (saved[k] ?? '')); }
  function focus(): void { container.querySelector<HTMLElement>('#obx-title')?.focus({ preventScroll: true }); }
  async function saveTransition(destination: string, work: () => Promise<void>): Promise<void> {
    const dialog = showExcelSavingDialog(container, destination, { mode: 'analyze' });
    try {
      await work();
      await dialog.confirm();
    } finally { dialog.close(); }
  }
  async function action(work: () => Promise<void>): Promise<void> {
    if (busy) return;
    busy = true; error = '';
    // Mantiene el editor y su selección mientras se envía; no reconstruye el formulario.
    container.querySelectorAll<HTMLButtonElement>('[data-command]').forEach(b => { b.disabled = true; });
    const editor = container.querySelector<HTMLTextAreaElement>('#obx-answer');
    if (editor) editor.disabled = true;
    const status = container.querySelector<HTMLElement>('[data-operation]');
    if (status) status.textContent = 'Guardando y preparando el siguiente paso…';
    try { await work(); }
    catch (cause) { error = (cause as Error).message; }
    finally { busy = false; render(); focus(); }
  }
  function feedback(grade: ObjectionCaseGrade): string {
    if (grade.checks.some(c => c.id === 'respuesta')) return `<div class="obx-feedback"><div class="obx-feedback-heading"><strong>${grade.score} / 20 puntos</strong><span>${grade.score === 20 ? 'Respuesta aprobada ✓' : 'Puedes mejorar el enfoque'}</span></div><p>${escapar(grade.checks[0]!.feedback)}</p>${grade.recommendations.length ? `<details class="obx-example"><summary>${grade.score === 20 ? 'Ideas para mejorar · No restan puntos' : 'Ver una orientación'}</summary><ul>${grade.recommendations.map(r => `<li>${escapar(r)}</li>`).join('')}</ul></details>` : ''}</div>`;
    return `<div class="obx-feedback"><div class="obx-feedback-heading"><strong>${grade.score} / 20 puntos</strong><span>${grade.critical.length ? 'Revisa las acciones de riesgo' : 'Revisión de tu gestión'}</span></div>
      ${grade.critical.length ? `<div class="obx-risk" role="alert"><strong>Revisión del intento anterior</strong><ul>${grade.critical.map(r => `<li>${escapar(r)}</li>`).join('')}</ul><p>Esta nota se conserva con las reglas del envío original. Practicar no modifica el resultado guardado.</p></div>` : ''}
      <ul class="obx-checks">${grade.checks.map(c => `<li class="${c.ok ? 'is-ok' : 'is-missing'}"><span aria-hidden="true">${c.ok ? '✓' : '○'}</span><div><strong>${escapar(c.label)}</strong><p>${escapar(c.feedback)}</p>${c.ok && c.evidence ? `<small>Se reconoció: «${escapar(c.evidence)}»</small>` : ''}</div><b>${c.points}/4</b></li>`).join('')}</ul>
    </div>`;
  }
  function introHtml(): string {
    const entry = state.cases[index]!;
    const copy = caseSlideCopy(entry.key);
    const nextLabel = index === 4 ? state.complete ? 'Practicar este caso' : 'Ir a la evaluación' : 'Tarjeta siguiente';
    return `<div class="obx-intro-stage"><button type="button" class="fontana-concept-arrow fontana-concept-arrow--left" data-command data-intro-prev aria-label="Tarjeta anterior" title="Tarjeta anterior" ${index === 0 ? 'disabled' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button>
      <div class="obx-slide" role="group" aria-roledescription="diapositiva" aria-label="Caso ${index + 1} de 5">
      <div class="obx-slide-topline"><span>FONTANA SCHOOL</span><span class="obx-case-number">CASO ${String(index + 1).padStart(2, '0')} / 05</span></div>
      ${caseIllustration(entry.key)}
      <div class="obx-slide-content"><h2 id="obx-title" tabindex="-1">${escapar(entry.title)}</h2><p class="obx-lead">${escapar(copy.summary)}</p>
        <ol class="obx-steps">${entry.actions.map((_, i) => { const visual = actionVisual(entry.key, i); return `<li><span class="obx-step-icon">${visual.icon}<small>${i + 1}</small></span><strong>${escapar(visual.title)}</strong></li>`; }).join('')}</ol>
      </div><div class="obx-slide-notes"><p class="obx-example-visible"><b>Ejemplo de enfoque:</b> ${escapar(copy.example)}</p><p class="obx-avoid"><b>Evita:</b> ${escapar(copy.avoid)}</p></div>
      </div><button type="button" class="fontana-concept-arrow fontana-concept-arrow--right" data-command data-intro-next aria-label="${nextLabel}" title="${nextLabel}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button></div>
      <div class="obx-intro-footer"><span aria-live="polite">Caso ${index + 1} de 5</span><p>${index === 4 ? `Usa la flecha derecha para ${state.complete ? 'practicar este caso' : 'ir a la evaluación'}.` : 'Usa las flechas para cambiar de tarjeta.'}</p></div>`;
  }
  function introExamHtml(): string {
    return `<section class="obx-exam-start"><span class="obx-big-icon">✎</span><p class="obx-eyebrow">AHORA ES TU TURNO</p><h2 id="obx-title" tabindex="-1">Responde con tus propias palabras</h2><p>Encontrarás los cinco casos, uno a la vez. En cada cuadro escribe cómo responderías al cliente y qué gestión dejarías registrada.</p>
      <div class="obx-rubric"><div><b>5 casos</b><span>20 puntos cada uno</span></div><div><b>${state.exam.minimumScore}/100</b><span>Para aprobar</span></div><div><b>1 reintento</b><span>Lo activas tú si no apruebas</span></div></div>
      <p>Propón una acción relacionada con cada caso y obtendrás sus 20 puntos. Una respuesta breve es suficiente: no necesitas un guion ni completar una lista de requisitos.</p><p class="obx-muted">Las sugerencias te ayudan a mejorar y no restan puntos. Puedes escribir o pegar tu respuesta y revisarla antes de enviarla. La revisión automática reconoce expresiones habituales; el administrador puede consultar el texto original.</p>
      <button class="obx-primary" data-command data-start ${state.exam.canStart ? '' : 'disabled'}>Comenzar mis cinco casos →</button>
      ${state.exam.waitUntil ? `<p>Podrás iniciar a partir de ${escapar(new Date(state.exam.waitUntil).toLocaleString('es-CO'))}.</p>` : ''}
      ${reactivationNotice({ activityId: state.exam.activityId, status: state.exam.status, requestedAt: state.exam.reactivationRequestedAt })}</section>`;
  }
  function editorHtml(practice: boolean): string {
    const entry = state.cases[index]!;
    const value = practice ? practiceText : answers[entry.key] ?? '';
    return `<section class="obx-writing"><header class="obx-writing-heading"><div><p class="obx-eyebrow">${practice ? 'PRÁCTICA LIBRE · SIN CAMBIAR TU NOTA' : `EVALUACIÓN · CASO ${index + 1} DE 5`}</p><h2 id="obx-title" tabindex="-1">${escapar(entry.title)}</h2></div><span class="obx-points">20 puntos</span></header>
      <blockquote class="obx-client">«${escapar(entry.client)}»</blockquote><p class="obx-context"><b>Ten en cuenta:</b> ${escapar(entry.situation)}</p>
      <textarea id="obx-answer" rows="7" maxlength="${OBJECTIONS_MAX_TEXT}" aria-label="Tu respuesta para ${escapar(entry.title)}" placeholder="Escribe aquí tu gestión con tus propias palabras…">${escapar(value)}</textarea>
      ${practice ? `<button class="obx-primary" data-command data-practice-review>Revisar mi respuesta ✦</button>${practiceResult ? feedback(practiceResult) : ''}` : `<div class="obx-navigation">${index < 4 ? '<button class="obx-primary" data-command data-answer-next>Continuar →</button>' : '<button class="obx-primary" data-command data-review-all>Revisar mis cinco respuestas →</button>'}</div>`}</section>`;
  }
  function reviewHtml(): string {
    return `<section class="obx-review"><p class="obx-eyebrow">ANTES DE ENVIAR</p><h2 id="obx-title" tabindex="-1">Revisa tus cinco gestiones</h2><p>Al enviar se califica y cierra este intento. Después podrás consultar tu nota.</p>${state.cases.map((c, i) => `<article><div><h3>${i + 1}. ${escapar(c.title)}</h3><button data-command data-edit="${i}">Editar</button></div><p>${escapar(answers[c.key] ?? 'Sin respuesta')}</p></article>`).join('')}<button class="obx-primary" data-command data-submit>Enviar mis respuestas y evaluar ✓</button></section>`;
  }
  function resultHtml(result: AdvisorObjectionsResult): string {
    return `<section class="obx-results"><header class="obx-result-summary ${result.passed ? 'is-ok' : 'is-missing'}">
      ${result.passed ? `<div class="obx-result-seal" role="img" aria-label="Sello obtenido: módulo 03, Enfréntate a la objeción, aprobado">${stampSvg('APROBADO', 'objections-result')}</div>` : ''}
      <div><p class="obx-eyebrow">${result.passed ? 'MÓDULO 03 · COMPLETADO' : 'RESULTADO OFICIAL'}</p><h2 id="obx-title" tabindex="-1">${result.passed ? '¡Obtuviste tu sello!' : 'Vamos a reforzar tu gestión'}</h2><p>${result.passed ? `Aprobaste «Enfréntate a la objeción». Tu resultado y tu sello están guardados.${state.nextRoute ? ` Continúa con ${escapar(state.nextName ?? 'la siguiente etapa')}.` : ''}` : 'Repasa las lecciones y las pautas generales de atención.'}</p></div><div class="obx-total">${result.score}<small>/ 100</small></div></header>
      ${result.passed ? `<div class="obx-result-actions">${state.nextRoute ? `<a class="obx-primary" href="${escapar(state.nextRoute)}">Continuar a ${escapar(state.nextName ?? 'la siguiente etapa')} →</a>` : ''}<a class="collections-back" href="${escapar(backHref)}">Ver mi progreso del aula →</a></div>` : ''}
      ${result.version === 1 ? '<p class="obx-muted">Este resultado conserva las reglas del envío original. La práctica y los nuevos envíos usan la revisión simplificada.</p>' : ''}
      <p class="obx-muted">La evaluación está cerrada. Las respuestas no están disponibles después del envío.</p>
      ${!result.passed ? reactivationNotice({ activityId: state.exam.activityId, status: state.exam.status, requestedAt: state.exam.reactivationRequestedAt }) : ''}</section>`;
  }
  function render(): void {
    container.innerHTML = `<section class="collections-course objections-course obx-course" aria-labelledby="obx-module-title"><header class="collections-heading fontana-progress-row"><div><p class="collections-kicker">MÓDULO 03 · APRENDE A GESTIONAR</p><h1 id="obx-module-title">Enfréntate a la objeción</h1><p>Escucha al cliente, explora alternativas y responde con tus propias palabras.</p></div>${progressGuide(backHref)}</header>
      ${state.legacyCompleted ? '<p class="obx-legacy">Tu módulo ya estaba completado. Conservamos ese resultado; puedes repasar y practicar estos nuevos casos.</p>' : ''}
      <div class="obx-layout${mode === 'intro' ? ' obx-layout--intro' : ''}">
      <article class="collections-card obx-workspace">
      ${error ? `<p class="obx-error" role="alert">${escapar(error)}</p>` : ''}
      <div class="obx-panel">${mode === 'intro' ? introHtml() : mode === 'practice' ? editorHtml(true) : mode === 'result' && state.exam.result ? resultHtml(state.exam.result) : confirming ? reviewHtml() : state.exam.draft ? editorHtml(false) : state.complete ? editorHtml(true) : introExamHtml()}</div>
      <div class="obx-view-links">${mode !== 'intro' ? '<button type="button" data-command data-mode="intro">← Repasar los casos</button>' : state.exam.draft ? '<button type="button" data-command data-mode="exam">Retomar mi evaluación →</button>' : ''}${mode !== 'result' && state.exam.result ? '<button type="button" data-command data-mode="result">Volver a mis resultados →</button>' : ''}</div>
      <p class="obx-operation" data-operation role="status" aria-live="polite"></p></article></div></section>`;
    bind();
  }
  function practiceAt(i: number): void { index = i; mode = 'practice'; confirming = false; practiceResult = null; practiceText = ''; }
  function bind(): void {
    container.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b => b.addEventListener('click', () => { void action(async () => { mode =b.dataset.mode as Mode; confirming = false; if (mode === 'exam' && state.complete) practiceAt(index); }); }));
    container.querySelector('[data-intro-prev]')?.addEventListener('click', () => { index--; render(); focus(); });
    container.querySelector('[data-intro-next]')?.addEventListener('click', () => {
      if (index < 4) index++; else if (state.complete) practiceAt(index); else { mode = 'exam'; index = 0; }
      render(); focus();
    });
    container.querySelector('[data-start]')?.addEventListener('click', () => { void action(async () => {
      const dialog = showExcelSavingDialog(container, 'tus cinco casos', { mode: 'start' });
      try {
        const opened = (await api<{ data: State }>(`${BASE}/exam/start`, { method: 'POST', body: '{}' })).data;
        await dialog.confirm();
        state = opened; answers = { ...state.exam.draft?.answers }; saved = { ...answers };
        index = Math.max(0, state.cases.findIndex(c => !(answers[c.key]?.trim().length > 0))); mode = 'exam';
      } finally { dialog.close(); }
    }); });
    const editor = container.querySelector<HTMLTextAreaElement>('#obx-answer');
    editor?.addEventListener('input', () => {
      if (mode === 'practice' || state.complete) { practiceText = editor.value; practiceResult = null; container.querySelector('.obx-feedback')?.remove(); return; }
      answers[state.cases[index]!.key] = editor.value;
    });
    for (const selector of ['[data-answer-next]', '[data-review-all]']) container.querySelector(selector)?.addEventListener('click', () => { void action(async () => {
      if (selector.includes('next')) index++; if (selector.includes('review-all')) confirming = true;
    }); });
    container.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach(b => b.addEventListener('click', () => { index = Number(b.dataset.edit); confirming = false; render(); focus(); }));
    container.querySelector('[data-submit]')?.addEventListener('click', () => { void action(async () => {
      const missing = state.cases.find(c => !(answers[c.key] ?? '').trim());
      if (missing) throw new Error(`Completa «${missing.title}» con una respuesta antes de enviar.`);
      let celebrate = false;
      await saveTransition('tus resultados', async () => {
        const { data } = await api<{ data: { state: State; alreadySubmitted: boolean } }>(`${BASE}/exam/submit`, { method: 'POST', body: JSON.stringify({ attemptId: state.exam.draft!.attemptId, answers }) });
        state = data.state; answers = {}; saved = {}; confirming = false; mode = 'result';
        celebrate = !data.alreadySubmitted && Boolean(state.exam.result?.passed);
      });
      render();
      if (celebrate) await playSeal({ moduleName: state.name, moduleNumber: 3, label: 'APROBADO', nextName: state.nextName });
    }); });
    container.querySelectorAll<HTMLButtonElement>('[data-practice-case]').forEach(b => b.addEventListener('click', () => { practiceAt(Number(b.dataset.practiceCase)); render(); focus(); }));
    container.querySelector('[data-practice-review]')?.addEventListener('click', () => { void action(async () => { practiceResult = (await api<{ data: ObjectionCaseGrade }>(`${BASE}/practice`, { method: 'POST', body: JSON.stringify({ key: state.cases[index]!.key, text: practiceText }) })).data; }); });
    bindReactivation(container, () => { void action(async () => { await load(); mode = 'exam'; confirming = false; }); });
  }
  const beforeUnload = (event: BeforeUnloadEvent) => { if (container.isConnected && dirty()) { event.preventDefault(); event.returnValue = ''; } };
  const keydown = (event: KeyboardEvent) => {
    if (mode !== 'intro' || busy || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || (event.target as HTMLElement)?.closest('textarea,input,[contenteditable="true"]')) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); container.querySelector<HTMLButtonElement>('[data-intro-next]')?.click(); }
    if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); container.querySelector<HTMLButtonElement>('[data-intro-prev]')?.click(); }
  };
  container.addEventListener('keydown', keydown);
  window.addEventListener('beforeunload', beforeUnload);
  if (import.meta.hot) import.meta.hot.dispose(() => { window.removeEventListener('beforeunload', beforeUnload); container.removeEventListener('keydown', keydown); });
}
