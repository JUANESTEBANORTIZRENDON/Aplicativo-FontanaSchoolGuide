import './collections.css';
import './collections-ui.css';
import { playSeal } from '../seal-animation';
import { api, escapar } from '../http';
import { mountConceptsSlider } from './concepts-slider';
import { mountExam, type ExamResult, type ExamState, type ExamDraft } from './exam';
import { PROCESS } from './lessons';
import { CHALLENGES, mountQuickChallenge, type QuickChallengeState } from './quick-challenge';
import { mountGuidedCase } from './guided-case';
import { GUIDED_BLOCKS, createGuidedCaseState, isGuidedBlock } from './guided-case-model';

type Content = { objective: string; explanation: string[]; example: { title: string; paragraphs: string[] }; workedExample: { decision: string; why: string }; validation: string[] };
type Block = { key: string; title: string; enabled: boolean; completed: boolean; content: Content | null };
type State = { name: string; experienced: boolean; diagnosticFirst: boolean; reviewMode: boolean; simulatorRoute: string | null; completedCount: number; percent: number; complete: boolean; currentBlock: string; blocks: Block[]; exam: ExamState };
const BASE = '/training/collections';
const EXAM = 'examen';

// Conceptos conserva sus tarjetas; los bloques 02 a 05 continúan un caso guiado. El asesor nuevo completa el módulo
// con la teoría; el asesor con experiencia presenta antes un examen diagnóstico (un intento) y luego la misma teoría.
export async function mountCollections(container: HTMLElement, backHref: string): Promise<void> {
  container.innerHTML = '<p role="status">Cargando tu inducción a las cobranzas…</p>';
  let state: State;
  let selected: string;
  let saving = false;
  let error = '';
  let examResult: ExamResult | null = null;
  const slides = new Map<string, number>();
  const challenges = new Map<string, QuickChallengeState>();
  const guidedCase = createGuidedCaseState();
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
    if (block.key === 'conceptos') return `${processHtml(block.key)}<p class="fontana-concepts-intro">Cinco claves para iniciar tu gestión.</p><div id="collections-concepts-slider"></div>`;
    if (isGuidedBlock(block.key)) return `${processHtml(block.key)}<p class="fontana-concepts-intro">${GUIDED_BLOCKS[block.key].intro}</p><div id="collections-guided-case"></div>`;
    return '';
  }
  async function continueBlock(block: Block): Promise<void> {
    if (saving || !(isGuidedBlock(block.key) ? guidedCase.progress[block.key].finished : challengeOf(block.key).finished)) return;
    saving = true; error = ''; render();
    try {
      const wasComplete = state.complete;
      state = (await api<{ data: State }>(`${BASE}/blocks/${block.key}/complete`, { method: 'POST', body: JSON.stringify({}) })).data;
      const next = state.blocks[state.blocks.findIndex((item) => item.key === block.key) + 1];
      selected = next?.enabled ? next.key : block.key;
      saving = false;
      if (!wasComplete && state.complete) await playSeal({ moduleName: 'Inducción a las cobranzas', moduleNumber: 2, label: 'COMPLETADO', nextName: 'Enfréntate a la objeción' });
      render(); focus('block-title');
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
    const lockedHint = state.diagnosticFirst ? 'Presenta primero el diagnóstico' : 'Completa el bloque anterior';
    const lock = '<svg viewBox="0 0 16 18" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="8" width="12" height="9" rx="2"/><path d="M4 8V5a4 4 0 0 1 8 0v3"/></svg>';
    const items = state.blocks.map((item, position) => `<li><button type="button" data-block="${item.key}"${item.enabled ? '' : ' disabled'}${item.key === selected ? ' aria-current="step"' : ''}><span class="collections-step">${item.completed ? '✓' : String(position + 1).padStart(2, '0')}</span><span class="collections-nav-copy">${escapar(item.title)}<small>${item.completed ? 'Completado · Puedes repasar' : item.enabled ? 'Disponible' : lockedHint}</small></span><span class="collections-nav-mark" aria-hidden="true">${item.enabled ? '›' : lock}</span></button></li>`);
    // Solo el asesor con experiencia tiene examen (diagnóstico); el nuevo recorre los cinco bloques.
    const exam = state.exam;
    const examItem = `<li class="collections-nav-exam"><button type="button" data-block="${EXAM}"${selected === EXAM ? ' aria-current="step"' : ''}><span class="collections-step">${exam.presented ? '✓' : '★'}</span><span class="collections-nav-copy">Examen diagnóstico<small>${exam.presented ? `Presentado · ${escapar(exam.statusLabel)}` : 'Primer paso · un intento'}</small></span><span class="collections-nav-mark" aria-hidden="true">›</span></button></li>`;
    const ordered = state.experienced ? [examItem, ...items] : items;
    return `<nav class="collections-nav" aria-label="Pasos del módulo"><div class="collections-nav-label"><span>Tu recorrido</span><small>${state.experienced ? 'Diagnóstico + 5 bloques' : '5 bloques'}</small></div><ol>${ordered.join('')}</ol></nav>`;
  }
  function progressLabel(): string {
    if (state.reviewMode) return 'Modo repaso · tus resultados oficiales no cambian';
    if (state.complete) return 'Teoría completada · Módulo completado';
    if (state.diagnosticFirst) return 'Tienes experiencia: empieza por el examen diagnóstico';
    return `${state.completedCount} de 5 bloques completados`;
  }
  function render(): void {
    const block = current();
    const onExam = selected === EXAM;
    if (!onExam && (!block?.content || !block.enabled)) return;
    const index = block ? state.blocks.indexOf(block) : -1;
    const subtitle = state.diagnosticFirst ? 'Muestra lo que ya sabes con el examen diagnóstico; después recorrerás la teoría del módulo.' : 'Acompaña el caso ficticio de Camila: comprende, decide y aprende.';
    container.innerHTML = `<section class="collections-course collections-course--induction" aria-labelledby="collections-title"><header class="collections-heading"><div><p class="collections-kicker">MÓDULO 02 · ${state.experienced ? 'PARA ASESORES CON EXPERIENCIA' : 'PARA ASESORES NUEVOS'}</p><h1 id="collections-title">Inducción a las cobranzas</h1><p>${escapar(subtitle)}</p></div><a href="${escapar(backHref)}" class="collections-back">Ver mi progreso del aula →</a></header>
      <div class="collections-progress"><div><strong>${escapar(progressLabel())}</strong><span>${state.percent} %</span></div><progress max="100" value="${state.percent}" aria-label="Avance del módulo 02">${state.percent} %</progress></div>
      ${state.complete ? `<div class="collections-complete" role="status"><strong>¡Completaste la inducción a las cobranzas!</strong><p>Ya tienes habilitado el módulo «Enfréntate a la objeción». Puedes repasar lo aprendido cuando quieras.</p>${state.simulatorRoute ? `<a class="collections-primary" href="${escapar(state.simulatorRoute)}">Ir a «Enfréntate a la objeción» →</a>` : ''}</div>` : ''}
      <div class="collections-layout">${navHtml()}
      <article class="collections-card"><div class="collections-block-toolbar"><p class="collections-kicker">${onExam ? 'EVALUACIÓN DIAGNÓSTICA' : `BLOQUE ${String(index + 1).padStart(2, '0')} DE 05`}</p></div><h2 id="block-title" tabindex="-1">${onExam ? 'Examen diagnóstico' : escapar(block!.title)}</h2>
      ${onExam ? '<div id="collections-exam"></div>' : lessonHtml(block!)}</article></div></section>`;
    const examRoot = container.querySelector<HTMLElement>('#collections-exam');
    if (examRoot) mountExam(examRoot, {
      exam: state.exam, experienced: state.experienced, theoryLocked: state.diagnosticFirst, simulatorRoute: state.simulatorRoute, backHref,
      result: examResult, submit: submitExam, goTheory,
      start: async () => (await api<{ data: ExamDraft }>(`${BASE}/exam/start`, { method: 'POST', body: JSON.stringify({}) })).data,
      saveSection: async (key, answers) => (await api<{ data: ExamDraft }>(`${BASE}/exam/sections/${key}`, { method: 'POST', body: JSON.stringify({ answers }) })).data,
    });
    if (block) {
      const dossier = container.querySelector<HTMLElement>('#collections-guided-case');
      if (dossier && isGuidedBlock(block.key)) mountGuidedCase(dossier, guidedCase, { block: block.key, onContinue: () => { void continueBlock(block); }, saving, error });
      const last = index === state.blocks.length - 1;
      const challenge = (root: HTMLElement) => mountQuickChallenge(root, challengeOf(block.key), {
        cases: CHALLENGES[block.key] ?? [], continueLabel: last ? 'Completar el módulo →' : 'Continuar al siguiente bloque →',
        onContinue: () => { void continueBlock(block); }, saving, error,
      });
      const onSlide = (position: number) => { slides.set(block.key, position); };
      const concepts = container.querySelector<HTMLElement>('#collections-concepts-slider');
      if (concepts) mountConceptsSlider(concepts, { initialSlide: slides.get(block.key) ?? 0, onSlide, mountChallenge: challenge });
    }
    container.querySelectorAll<HTMLButtonElement>('[data-block]').forEach((button) => button.addEventListener('click', async () => {
      if (saving) return;
      if (button.dataset.block === EXAM) {
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
