import './collections.css';
import { api, escapar } from '../http';
import { mountConceptsSlider, mountSlider } from './concepts-slider';
import { mountExam, type ExamResult, type ExamState } from './exam';
import { LESSONS, PROCESS } from './lessons';
import { CHALLENGES, mountQuickChallenge, type QuickChallengeState } from './quick-challenge';

type Content = { objective: string; explanation: string[]; example: { title: string; paragraphs: string[] }; workedExample: { decision: string; why: string }; validation: string[] };
type Block = { key: string; title: string; enabled: boolean; completed: boolean; content: Content | null };
type State = { name: string; experienced: boolean; theoryRequired: boolean; simulatorRoute: string | null; completedCount: number; percent: number; complete: boolean; currentBlock: string; blocks: Block[]; exam: ExamState };
const BASE = '/training/collections';
const EXAM = 'examen';

// Cada bloque: tarjetas cortas de teoría y, al final, un reto rápido de dos opciones. El examen final valida.
export async function mountCollections(container: HTMLElement, backHref: string): Promise<void> {
  container.innerHTML = '<p role="status">Cargando tu inducción a las cobranzas…</p>';
  let state: State;
  let selected: string;
  let saving = false;
  let error = '';
  let examResult: ExamResult | null = null;
  const slides = new Map<string, number>();
  const challenges = new Map<string, QuickChallengeState>();
  try {
    state = (await api<{ data: State }>(`${BASE}/module`)).data;
    selected = state.currentBlock;
    render();
  } catch (cause) {
    container.innerHTML = `<section class="auth-card collections-error"><h2>No pudimos abrir el módulo</h2><p role="alert">${escapar((cause as Error).message)}</p><a href="${escapar(backHref)}">Volver a tu ruta</a></section>`;
  }

  function current(): Block | undefined { return state.blocks.find((block) => block.key === selected); }
  function challengeOf(key: string): QuickChallengeState {
    if (!challenges.has(key)) challenges.set(key, { index: 0, answers: [], finished: false });
    return challenges.get(key)!;
  }
  function focus(id: string): void { container.querySelector<HTMLElement>(`#${id}`)?.focus(); }
  // Ruta de la gestión: ubica el bloque dentro del proceso completo.
  function processHtml(key: string): string {
    const position = PROCESS.findIndex((step) => step.key === key);
    return `<ol class="collections-process" aria-label="Ruta de la gestión de cobranza">${PROCESS.map((step, index) => `<li class="${index < position ? 'is-done' : index === position ? 'is-current' : ''}"${index === position ? ' aria-current="step"' : ''}><span>${index + 1}</span>${escapar(step.label)}</li>`).join('')}</ol>`;
  }
  function lessonHtml(block: Block): string {
    const content = block.content!;
    if (block.key === 'conceptos') return `${processHtml(block.key)}<p class="fontana-concepts-intro">Cinco claves para iniciar tu gestión.</p><div id="collections-concepts-slider"></div>`;
    return `${processHtml(block.key)}<p class="fontana-concepts-intro">${escapar(content.objective)}</p>
      <div id="collections-lesson-slider"></div>
      <details class="collections-more"><summary>Ver un ejemplo resuelto</summary><p class="collections-case-caption">${escapar(content.example.title)}</p>${content.example.paragraphs.map((text) => `<p>${escapar(text)}</p>`).join('')}
        <div class="collections-solved"><strong>Qué haría el asesor</strong><p>${escapar(content.workedExample.decision)}</p><strong>Por qué</strong><p>${escapar(content.workedExample.why)}</p></div></details>
      <details class="collections-validation"><summary>Qué requiere validación interna antes de una gestión real</summary><ul>${content.validation.map((text) => `<li>${escapar(text)}</li>`).join('')}</ul></details>`;
  }
  async function continueBlock(block: Block): Promise<void> {
    if (saving || !challengeOf(block.key).finished) return;
    saving = true; error = ''; render();
    try {
      state = (await api<{ data: State }>(`${BASE}/blocks/${block.key}/complete`, { method: 'POST', body: JSON.stringify({}) })).data;
      const next = state.blocks[state.blocks.findIndex((item) => item.key === block.key) + 1];
      selected = next?.enabled ? next.key : EXAM;
      saving = false; render(); focus('block-title');
    } catch (cause) {
      saving = false; error = (cause as Error).message; render(); focus('collections-error');
    }
  }
  async function submitExam(answers: Record<string, string>): Promise<void> {
    const { data } = await api<{ data: { result: ExamResult; state: State } }>(`${BASE}/exam`, { method: 'POST', body: JSON.stringify({ answers }) });
    state = data.state;
    examResult = data.result;
    selected = EXAM;
    render(); focus('exam-title');
  }
  function goTheory(): void {
    const target = state.blocks.find((block) => block.enabled && !block.completed) ?? state.blocks.find((block) => block.enabled);
    if (!target) return;
    examResult = null;
    selected = target.key;
    render(); focus('block-title');
  }
  function navHtml(): string {
    const lockedHint = state.experienced && !state.theoryRequired ? 'Se abre si la necesitas' : 'Completa el bloque anterior';
    const lock = '<svg viewBox="0 0 16 18" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="8" width="12" height="9" rx="2"/><path d="M4 8V5a4 4 0 0 1 8 0v3"/></svg>';
    const items = state.blocks.map((item, position) => `<li><button type="button" data-block="${item.key}"${item.enabled ? '' : ' disabled'}${item.key === selected ? ' aria-current="step"' : ''}><span class="collections-step">${item.completed ? '✓' : String(position + 1).padStart(2, '0')}</span><span class="collections-nav-copy">${escapar(item.title)}<small>${item.completed ? 'Completado · Puedes repasar' : item.enabled ? 'Disponible' : lockedHint}</small></span><span class="collections-nav-mark" aria-hidden="true">${item.enabled ? '›' : lock}</span></button></li>`);
    const exam = state.exam;
    const open = exam.enabled || Boolean(examResult);
    const examItem = `<li class="collections-nav-exam"><button type="button" data-block="${EXAM}"${open ? '' : ' disabled'}${selected === EXAM ? ' aria-current="step"' : ''}><span class="collections-step">${exam.passed ? '✓' : '★'}</span><span class="collections-nav-copy">Examen final<small>${exam.passed ? 'Aprobado · Simulador habilitado' : exam.enabled ? 'Disponible' : 'Completa los cinco bloques'}</small></span><span class="collections-nav-mark" aria-hidden="true">${open ? '›' : lock}</span></button></li>`;
    const ordered = state.experienced && !state.theoryRequired ? [examItem, ...items] : [...items, examItem];
    return `<nav class="collections-nav" aria-label="Pasos del módulo"><div class="collections-nav-label"><span>Tu recorrido</span><small>${state.experienced && !state.theoryRequired ? 'Examen primero' : '5 bloques + examen'}</small></div><ol>${ordered.join('')}</ol></nav>`;
  }
  function progressLabel(): string {
    if (state.complete) return 'Examen aprobado · Módulo completado';
    if (state.experienced && !state.theoryRequired) return 'Tienes experiencia: presenta el examen final';
    return `${state.completedCount} de 5 bloques completados${state.completedCount === 5 ? ' · Falta el examen final' : ''}`;
  }
  function render(): void {
    const block = current();
    const onExam = selected === EXAM;
    if (!onExam && (!block?.content || !block.enabled)) return;
    const index = block ? state.blocks.indexOf(block) : -1;
    const subtitle = state.experienced && !state.theoryRequired ? 'Valida lo que ya sabes con el examen final y continúa al simulador.' : 'Acompaña el caso ficticio de Camila: comprende, decide y aprende.';
    container.innerHTML = `<section class="collections-course" aria-labelledby="collections-title"><header class="collections-heading"><div><p class="collections-kicker">MÓDULO 02 · ${state.experienced ? 'PARA ASESORES CON EXPERIENCIA' : 'PARA ASESORES NUEVOS'}</p><h1 id="collections-title">Inducción a las cobranzas</h1><p>${escapar(subtitle)}</p></div><a href="${escapar(backHref)}" class="collections-back">← Tu ruta</a></header>
      <div class="collections-progress"><div><strong>${escapar(progressLabel())}</strong><span>${state.percent} %</span></div><progress max="100" value="${state.percent}" aria-label="Avance del módulo 02">${state.percent} %</progress></div>
      ${state.complete ? `<div class="collections-complete" role="status"><strong>¡Completaste la inducción a las cobranzas!</strong><p>Ya tienes habilitado el Simulador de cobranzas. Puedes repasar lo aprendido cuando quieras.</p>${state.simulatorRoute ? `<a class="collections-primary" href="${escapar(state.simulatorRoute)}">Ir al Simulador →</a>` : ''}</div>` : ''}
      <div class="collections-layout">${navHtml()}
      <article class="collections-card"><div class="collections-block-toolbar"><p class="collections-kicker">${onExam ? 'EVALUACIÓN FINAL' : `BLOQUE ${String(index + 1).padStart(2, '0')} DE 05`}</p></div><h2 id="block-title" tabindex="-1">${onExam ? 'Examen final' : escapar(block!.title)}</h2>
      ${onExam ? '<div id="collections-exam"></div>' : lessonHtml(block!)}</article></div></section>`;
    const examRoot = container.querySelector<HTMLElement>('#collections-exam');
    if (examRoot) mountExam(examRoot, {
      exam: state.exam, experienced: state.experienced, theoryRequired: state.theoryRequired, simulatorRoute: state.simulatorRoute, backHref,
      blockTitles: Object.fromEntries(state.blocks.map((item) => [item.key, item.title])), result: examResult, submit: submitExam, goTheory,
    });
    if (block) {
      const last = index === state.blocks.length - 1;
      const challenge = (root: HTMLElement) => mountQuickChallenge(root, challengeOf(block.key), {
        cases: CHALLENGES[block.key] ?? [], continueLabel: last ? 'Continuar al examen final →' : 'Continuar al siguiente bloque →',
        onContinue: () => { void continueBlock(block); }, saving, error,
      });
      const onSlide = (position: number) => { slides.set(block.key, position); };
      const concepts = container.querySelector<HTMLElement>('#collections-concepts-slider');
      if (concepts) mountConceptsSlider(concepts, { initialSlide: slides.get(block.key) ?? 0, onSlide, mountChallenge: challenge });
      const lesson = container.querySelector<HTMLElement>('#collections-lesson-slider');
      if (lesson) mountSlider(lesson, {
        slides: LESSONS[block.key] ?? [], label: `Teoría del bloque ${block.title} y reto rápido`,
        notice: '<strong>Lee con atención:</strong> al terminar las tarjetas tendrás un reto rápido.',
        finalName: 'Reto rápido', finalLastHint: 'Pulsa la flecha derecha para ir al reto rápido.', finalHint: 'Elige una respuesta y practica a tu ritmo.',
        initialSlide: slides.get(block.key) ?? 0, onSlide, mountFinal: challenge,
        finalFocus: '#quick-challenge-question, #quick-challenge-title',
      });
    }
    container.querySelectorAll<HTMLButtonElement>('[data-block]').forEach((button) => button.addEventListener('click', async () => {
      if (saving) return;
      if (button.dataset.block === EXAM) {
        if (!state.exam.enabled && !examResult) return;
        selected = EXAM; error = ''; render(); focus('block-title');
        return;
      }
      const target = state.blocks.find((item) => item.key === button.dataset.block)!;
      if (!target.enabled) return;
      if (!target.content) {
        try { state = (await api<{ data: State }>(`${BASE}/module`)).data; }
        catch (cause) { error = (cause as Error).message; render(); return; }
      }
      selected = target.key; error = '';
      render(); focus('block-title');
    }));
  }
}
