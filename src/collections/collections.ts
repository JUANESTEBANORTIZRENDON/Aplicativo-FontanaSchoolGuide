import './collections.css';
import { api, escapar } from '../http';
import { mountConceptsSlider } from './concepts-slider';
import { mountQuickChallenge, type QuickChallengeState } from './quick-challenge';

type Choice = { id: string; text: string };
type Question = { key: string; prompt: string; hint: string; kind: 'select' | 'radio'; options: Choice[] };
type Result = { key: string; correct: boolean; selected: string; feedback: string; options: (Choice & { correct: boolean; feedback: string })[] };
type Feedback = { passed: boolean; correctKeys: string[]; correctCount: number; total: number; expected: string | null; results: Result[] };
type Content = { objective: string; explanation: string[]; example: { title: string; paragraphs: string[] }; workedExample: { decision: string; why: string }; validation: string[]; exercise: string; questions: Question[] };
type Block = { key: string; title: string; enabled: boolean; completed: boolean; attempts: number; answers: Record<string, string>; feedback: Feedback | null; content: Content | null };
type State = { name: string; completedCount: number; percent: number; complete: boolean; currentBlock: string; blocks: Block[] };
type Submission = Feedback & { answers: Record<string, string>; questionResult: Result; completed: boolean; attempts: number; completedKeys: string[]; nextBlock: { key: string; content: Content } | null; completedCount: number; percent: number; complete: boolean };
type Screen = 'learn' | 'practice' | 'summary';
const BASE = '/training/collections';
const CHAT: Record<string, { speaker: string; text: string }> = {
  apertura: { speaker: 'Situación', text: 'Una persona contesta el contacto. Aún no has verificado su identidad.' },
  escucha: { speaker: 'Camila', text: 'Este mes tuve un gasto inesperado.' },
  aclarar: { speaker: 'Camila', text: 'Tal vez pueda abonar algo.' },
  identidad: { speaker: 'Situación', text: 'No fue posible verificar la identidad de la persona.' },
};

export async function mountCollections(container: HTMLElement, backHref: string): Promise<void> {
  container.innerHTML = '<p role="status">Cargando tu inducción a las cobranzas…</p>';
  let state: State;
  let selected: string;
  let screen: Screen = 'learn';
  let questionKey = '';
  let saving = false;
  let error = '';
  let conceptSlide = 0;
  const quickChallenge: QuickChallengeState = { index: 0, answers: [], finished: false };
  const drafts = new Map<string, string>();
  const changed = new Set<string>();
  try {
    state = (await api<{ data: State }>(`${BASE}/module`)).data;
    selected = state.currentBlock;
    chooseScreen();
    render();
  } catch (cause) {
    container.innerHTML = `<section class="auth-card collections-error"><h2>No pudimos abrir el módulo</h2><p role="alert">${escapar((cause as Error).message)}</p><a href="${escapar(backHref)}">Volver a tu ruta</a></section>`;
  }

  function current(): Block { return state.blocks.find((block) => block.key === selected)!; }
  function correctKeys(block: Block): string[] { return block.feedback?.correctKeys ?? []; }
  function firstPending(block: Block): string { return block.content!.questions.find((q) => !correctKeys(block).includes(q.key))?.key ?? block.content!.questions[0]!.key; }
  function chooseScreen(): void {
    const block = current();
    screen = block.key === 'conceptos' ? 'learn' : block.completed ? 'summary' : block.feedback?.results.length ? 'practice' : 'learn';
    questionKey = firstPending(block);
    error = '';
  }
  function focus(id: string): void { container.querySelector<HTMLElement>(`#${id}`)?.focus(); }
  function validationHtml(block: Block): string {
    return `<details class="collections-validation"><summary>Qué requiere validación interna antes de una gestión real</summary><ul>${block.content!.validation.map((text) => `<li>${escapar(text)}</li>`).join('')}</ul></details>`;
  }
  function lessonHtml(block: Block): string {
    const content = block.content!;
    if (block.key === 'conceptos') return '<p class="fontana-concepts-intro">Cinco claves para iniciar tu gestión.</p><div id="collections-concepts-slider"></div>';
    return `<div class="collections-objective"><strong>Lo que vas a aprender</strong><p>${escapar(content.objective)}</p></div>
      <section class="collections-lesson"><h3>1. Entiende la idea</h3>${content.explanation.map((text) => `<p>${escapar(text)}</p>`).join('')}</section>
      <section class="collections-example"><h3>2. Mira un ejemplo resuelto</h3><p class="collections-case-caption">${escapar(content.example.title)}</p>${content.example.paragraphs.map((text) => `<p>${escapar(text)}</p>`).join('')}
        <div class="collections-solved"><strong>Qué haría el asesor</strong><p>${escapar(content.workedExample.decision)}</p><strong>Por qué</strong><p>${escapar(content.workedExample.why)}</p></div></section>
      ${validationHtml(block)}<div class="collections-actions"><p>Ahora te toca decidir. Una pregunta a la vez, con pistas y reintentos.</p><button type="button" data-start class="collections-primary">3. ${block.feedback?.results.length ? 'Continuar mi práctica' : 'Empezar mi práctica'} →</button></div>`;
  }
  function noteHtml(block: Block, question?: Question): string {
    const fields = ['Resultado', 'Compromiso', 'Pendiente', 'Próxima acción'];
    return `<section class="collections-note-preview"><h4>Tu nota de gestión · Caso ficticio de Camila</h4><dl>${block.content!.questions.slice(0, 4).map((q, index) => {
      const selectedAnswer = drafts.get(`${block.key}/${q.key}`) ?? block.answers[q.key];
      const value = q.options.find((option) => option.id === selectedAnswer)?.text;
      return `<div${question?.key === q.key ? ' class="note-current"' : ''}><dt>${fields[index]}</dt><dd>${value ? escapar(value) : 'Por completar'}</dd></div>`;
    }).join('')}</dl><small>Borrador de práctica. Las respuestas se revisan al comprobar.</small></section>`;
  }
  function scenarioHtml(block: Block, question: Question): string {
    const content = block.content!;
    if (block.key === 'conceptos') return `<div class="collections-concept-card"><span>CONCEPTO</span><strong>${escapar(question.key === 'promesa' ? 'Promesa o pago' : question.prompt.replace('¿Qué significa ', '').replace('?', ''))}</strong><small>↓ Encuentra su significado entre las tres tarjetas</small></div>`;
    if (block.key === 'preparacion') return `<section class="collections-case-file"><h4>Ficha ficticia F-204 · Busca lo que falta aclarar</h4>${content.example.paragraphs.map((text) => `<p>${escapar(text)}</p>`).join('')}</section>`;
    if (block.key === 'contacto') {
      const line = CHAT[question.key]!;
      return `<section class="collections-chat" aria-label="Conversación de práctica"><p class="collections-chat-label">CONVERSACIÓN FICTICIA</p><div class="collections-chat-client"><strong>${line.speaker}</strong><p>${escapar(line.text)}</p></div><p class="collections-chat-prompt">Tu turno: elige cómo responderías.</p></section>`;
    }
    if (block.key === 'alternativas') return `<section class="collections-permission"><h4>Ficha de autorización · Solo para este ejercicio</h4><p>${escapar(content.example.paragraphs[0])}</p><small>No representa condiciones reales de Fontana.</small></section>`;
    return noteHtml(block, question);
  }
  function resultHtml(result: Result): string {
    return `${current().key === 'contacto' ? `<div class="collections-chat-advisor"><strong>Tu respuesta</strong><p>${escapar(result.options.find((option) => option.id === result.selected)?.text)}</p></div>` : ''}<section class="collections-feedback ${result.correct ? 'is-correct' : 'needs-review'}" aria-labelledby="question-feedback-title"><h3 id="question-feedback-title" tabindex="-1">${result.correct ? '¡Bien! Esa es la idea.' : 'Vamos a revisarlo'}</h3><p>${escapar(result.feedback)}</p>
      ${!result.correct ? '<p>Elige otra respuesta y compruébala. Tus aciertos anteriores siguen guardados.</p>' : ''}
      <details><summary>Entender cada opción</summary><ul>${result.options.map((option) => `<li><strong>${escapar(option.text)}</strong><p>${option.correct ? '✓ ' : ''}${escapar(option.feedback)}</p></li>`).join('')}</ul></details></section>`;
  }
  function practiceHtml(block: Block): string {
    const questions = block.content!.questions;
    const question = questions.find((q) => q.key === questionKey) ?? questions[0]!;
    questionKey = question.key;
    const position = questions.indexOf(question);
    const known = correctKeys(block);
    const resolved = known.includes(question.key);
    const key = `${block.key}/${question.key}`;
    const answer = drafts.get(key) ?? block.answers[question.key];
    const result = changed.has(key) ? undefined : block.feedback?.results.find((item) => item.key === question.key);
    return `<div class="collections-practice-top"><button type="button" data-learn class="collections-text-button">← Ver explicación y ejemplo</button><span>${known.length} de ${questions.length} resueltas</span></div>
      <nav class="collections-question-nav" aria-label="Preguntas del bloque">${questions.map((q, index) => `<button type="button" data-question="${q.key}" aria-label="Pregunta ${index + 1}${known.includes(q.key) ? ', resuelta' : ', pendiente'}"${q.key === question.key ? ' aria-current="step"' : ''} class="${known.includes(q.key) ? 'is-solved' : ''}">${known.includes(q.key) ? '✓' : index + 1}</button>`).join('')}</nav>
      <p class="collections-kicker">PREGUNTA ${position + 1} DE ${questions.length}${resolved ? ' · RESUELTA' : ''}</p>
      ${scenarioHtml(block, question)}
      <form class="collections-practice collections-one-question" id="collections-form" aria-busy="${saving}"><fieldset class="collections-question"><legend id="question-title" tabindex="-1">${escapar(question.prompt)}</legend>
        <div class="${block.key === 'conceptos' ? 'collections-choice-grid' : ''}">${question.options.map((option, index) => `<label class="collections-option${resolved && answer === option.id ? ' is-mastered' : ''}"><input type="radio" name="answer" value="${option.id}" required${answer === option.id ? ' checked' : ''}${resolved || saving ? ' disabled' : ''}><span><strong class="collections-choice-letter">${String.fromCharCode(65 + index)}.</strong> ${escapar(option.text)}</span></label>`).join('')}</div></fieldset>
        <details class="collections-hint"><summary>Necesito una pista</summary><p>${escapar(question.hint)}</p></details>
        <p id="collections-error" role="alert" tabindex="-1" class="collections-submit-error"${!error ? ' hidden' : ''}>${escapar(error)}</p>
        ${!resolved ? `<button type="submit" class="collections-primary"${saving ? ' disabled' : ''}>${saving ? 'Comprobando y guardando…' : 'Comprobar mi respuesta'}</button>` : '<p class="collections-saved">✓ Esta respuesta ya está guardada. Puedes seguir con las pendientes.</p>'}
      </form>${result ? resultHtml(result) : ''}
      <div class="collections-actions">${block.completed ? '<button type="button" data-summary class="collections-primary">Ver resumen del bloque →</button>' : `<button type="button" data-next-question class="collections-primary"${!resolved ? ' disabled' : ''}>Continuar con otra pregunta →</button>`}</div>
      <p class="collections-practice-note">Caso ficticio · Reintentos ilimitados · Tus aciertos se conservan.</p>`;
  }
  function summaryHtml(block: Block): string {
    const next = state.blocks[state.blocks.indexOf(block) + 1];
    return `<section class="collections-block-finish"><span aria-hidden="true">✓</span><h3>¡Bloque completado!</h3><p>Resolviste las ${block.content!.questions.length} preguntas. Tus respuestas y tu avance están guardados.</p></section>
      <div class="collections-expected"><strong>Lo que ya sabes hacer</strong><p>${escapar(block.feedback?.expected ?? block.content!.objective)}</p></div>
      ${block.key === 'seguimiento' ? noteHtml(block) : ''}
      <details class="collections-review"><summary>Repasar mis respuestas y las explicaciones</summary>${block.feedback?.results.map((result) => `<article class="collections-answer"><h4>${escapar(block.content!.questions.find((q) => q.key === result.key)?.prompt)}</h4><p>${escapar(result.options.find((option) => option.id === result.selected)?.text)}</p><p>${escapar(result.feedback)}</p></article>`).join('') ?? ''}</details>
      ${validationHtml(block)}
      <div class="collections-actions"><button type="button" data-start class="collections-secondary">Repasar una pregunta a la vez</button>${next ? `<button type="button" data-block="${next.key}" class="collections-primary"${next.enabled ? '' : ' disabled'}>Ir al siguiente bloque →</button>` : `<a class="collections-primary" href="${escapar(backHref)}">Volver a mi ruta →</a>`}</div>`;
  }
  async function continueConcepts(): Promise<void> {
    if (saving || !quickChallenge.finished) return;
    saving = true; error = ''; render();
    try {
      state = (await api<{ data: State }>(`${BASE}/blocks/conceptos/complete`, { method: 'POST', body: JSON.stringify({}) })).data;
      selected = state.blocks[1]!.key;
      chooseScreen();
      saving = false; render(); focus('block-title');
    } catch (cause) {
      saving = false; error = (cause as Error).message; render(); focus('collections-error');
    }
  }
  function render(): void {
    const block = current();
    if (!block.content || !block.enabled) return;
    const index = state.blocks.indexOf(block);
    container.innerHTML = `<section class="collections-course" aria-labelledby="collections-title"><header class="collections-heading"><div><p class="collections-kicker">MÓDULO 02 · PARA ASESORES NUEVOS</p><h1 id="collections-title">Inducción a las cobranzas</h1><p>Acompaña el caso ficticio de Camila: comprende, decide y aprende.</p></div><a href="${escapar(backHref)}" class="collections-back">← Tu ruta</a></header>
      <div class="collections-progress"><div><strong>${state.completedCount} de 5 bloques completados</strong><span>${state.percent} %</span></div><progress max="100" value="${state.percent}" aria-label="Avance del módulo 02">${state.percent} %</progress></div>
      ${state.complete ? '<div class="collections-complete" role="status"><strong>¡Completaste la inducción a las cobranzas!</strong><p>Puedes repasar lo aprendido o volver a tu ruta de formación.</p></div>' : ''}
      <div class="collections-layout"><nav class="collections-nav" aria-label="Bloques del módulo"><div class="collections-nav-label"><span>Tu recorrido</span><small>5 bloques</small></div><ol>${state.blocks.map((item, position) => `<li><button type="button" data-block="${item.key}"${item.enabled ? '' : ' disabled'}${item.key === selected ? ' aria-current="step"' : ''}><span class="collections-step">${item.completed ? '✓' : String(position + 1).padStart(2, '0')}</span><span class="collections-nav-copy">${escapar(item.title)}<small>${item.completed ? 'Completado · Puedes repasar' : item.enabled ? 'Disponible' : 'Completa el bloque anterior'}</small></span><span class="collections-nav-mark" aria-hidden="true">${item.enabled ? '›' : '<svg viewBox="0 0 16 18" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="8" width="12" height="9" rx="2"/><path d="M4 8V5a4 4 0 0 1 8 0v3"/></svg>'}</span></button></li>`).join('')}</ol></nav>
      <article class="collections-card"><div class="collections-block-toolbar"><p class="collections-kicker">BLOQUE ${String(index + 1).padStart(2, '0')} DE 05</p></div><h2 id="block-title" tabindex="-1">${escapar(block.title)}</h2>
      ${screen === 'learn' ? lessonHtml(block) : screen === 'summary' ? summaryHtml(block) : practiceHtml(block)}</article></div></section>`;
    const slider = container.querySelector<HTMLElement>('#collections-concepts-slider');
    if (slider) mountConceptsSlider(slider, {
      initialSlide: conceptSlide,
      onSlide: (index) => { conceptSlide = index; },
      mountChallenge: (root) => mountQuickChallenge(root, quickChallenge, { onContinue: continueConcepts, saving, error }),
    });
    container.querySelectorAll<HTMLButtonElement>('[data-block]').forEach((button) => button.addEventListener('click', async () => {
      if (saving) return;
      const target = state.blocks.find((item) => item.key === button.dataset.block)!;
      if (!target.enabled) return;
      if (!target.content) {
        try { state = (await api<{ data: State }>(`${BASE}/module`)).data; }
        catch (cause) { error = (cause as Error).message; render(); return; }
      }
      selected = target.key;
      chooseScreen(); render(); focus('block-title');
    }));
    container.querySelectorAll<HTMLButtonElement>('[data-start]').forEach((button) => button.addEventListener('click', () => {
      if (saving) return;
      screen = 'practice'; questionKey = firstPending(block); error = ''; render(); focus('question-title');
    }));
    container.querySelector('[data-learn]')?.addEventListener('click', () => { if (!saving) { screen = 'learn'; render(); focus('block-title'); } });
    container.querySelector('[data-summary]')?.addEventListener('click', () => { if (!saving) { screen = 'summary'; render(); focus('block-title'); } });
    container.querySelectorAll<HTMLButtonElement>('[data-question]').forEach((button) => button.addEventListener('click', () => {
      if (saving) return;
      questionKey = button.dataset.question!; error = ''; render(); focus('question-title');
    }));
    container.querySelector('[data-next-question]')?.addEventListener('click', () => {
      if (saving) return;
      const questions = block.content!.questions;
      const index = questions.findIndex((q) => q.key === questionKey);
      const remaining = [...questions.slice(index + 1), ...questions.slice(0, index + 1)].find((q) => !correctKeys(block).includes(q.key));
      if (remaining) { questionKey = remaining.key; error = ''; render(); focus('question-title'); }
    });
    const form = container.querySelector<HTMLFormElement>('#collections-form');
    form?.addEventListener('change', () => {
      const answer = new FormData(form).get('answer');
      if (typeof answer !== 'string') return;
      drafts.set(`${block.key}/${questionKey}`, answer);
      changed.add(`${block.key}/${questionKey}`);
      container.querySelector<HTMLElement>('.collections-feedback')?.remove();
      container.querySelector<HTMLElement>('.collections-chat-advisor')?.remove();
      if (block.key === 'seguimiento') {
        const preview = container.querySelector('.collections-note-preview');
        if (preview) preview.outerHTML = noteHtml(block, block.content!.questions.find((q) => q.key === questionKey));
      }
    });
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (saving || !form.reportValidity()) return;
      const answer = new FormData(form).get('answer');
      if (typeof answer !== 'string') return;
      const submittedKey = questionKey;
      drafts.set(`${block.key}/${submittedKey}`, answer);
      saving = true; error = ''; render();
      try {
        const { data } = await api<{ data: Submission }>(`${BASE}/blocks/${block.key}/questions/${submittedKey}`, { method: 'POST', body: JSON.stringify({ answer }) });
        block.answers = data.answers;
        block.feedback = data;
        block.completed = data.completed;
        block.attempts = data.attempts;
        drafts.delete(`${block.key}/${submittedKey}`);
        changed.delete(`${block.key}/${submittedKey}`);
        state.completedCount = data.completedCount; state.percent = data.percent; state.complete = data.complete;
        state.blocks.forEach((item, position) => { item.completed = data.completedKeys.includes(item.key); item.enabled = state.blocks.slice(0, position).every((previous) => data.completedKeys.includes(previous.key)); });
        if (data.nextBlock) state.blocks.find((item) => item.key === data.nextBlock!.key)!.content = data.nextBlock.content;
        saving = false; render(); focus('question-feedback-title');
      } catch (cause) {
        saving = false; error = (cause as Error).message; render(); focus('collections-error');
      }
    });
  }
}
