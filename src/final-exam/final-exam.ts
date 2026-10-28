import './final-exam.css';
import { progressGuide } from '../progress-guide';
import { api, ApiError, escapar, formatDate } from '../http';
import { bindReactivation, reactivationNotice, statusChip, type EvaluationStatus } from '../reactivation';

// Módulo 05 «Examen general»: selección múltiple A, B, C y D sobre toda la formación. Un intento: las respuestas se
// guardan en el servidor al marcarlas (se puede cerrar y retomar) y solo el servidor califica al enviar.

type Letter = 'A' | 'B' | 'C' | 'D';
type Question = { id: string; topicLabel: string; prompt: string; options: { letter: Letter; text: string }[] };
type Grade = {
  score: number; correct: number; total: number; minimumScore: number; passed: boolean;
  topics: { label: string; correct: number; total: number; percent: number }[];
  recommendations: string[];
};
type Result = { attemptId: string; number: number; score: string | null; passed: boolean; submittedAt: string | null; finalExam?: Grade };
type State = {
  activityId: string; reviewMode: boolean; status: EvaluationStatus; statusLabel: string; questionCount: number; minimumScore: number; canStart: boolean;
  reactivationRequestedAt: string | null; nextRoute: string | null; inProgress: { answered: number; total: number } | null; result: Result | null;
};

export async function mountFinalExam(container: HTMLElement, backHref: string, moduleOrder = 5): Promise<void> {
  container.innerHTML = `<section class="fexam">
    <div class="fontana-progress-row">
      <p class="auth-kicker">MÓDULO ${String(moduleOrder).padStart(2, '0')}</p>
      ${progressGuide(backHref)}
    </div>
    <div data-fexam-view><p role="status">Cargando el examen general…</p></div>
  </section>`;
  const root = container.querySelector<HTMLElement>('[data-fexam-view]')!;
  let state: State;
  let questions: { question: Question; selected: Letter | null }[] = [];
  let index = 0;
  let saving = false;
  let error = '';

  const back = `<a class="secondary-link" href="${escapar(backHref)}">← Volver a tu ruta</a>`;

  async function load(): Promise<void> {
    try {
      state = (await api<{ data: State }>('/training/final-exam')).data;
      renderIntro();
    } catch (cause) {
      const reason = cause instanceof ApiError && typeof cause.details?.blockedReason === 'string' ? cause.details.blockedReason : (cause as Error).message;
      root.innerHTML = `<h2>Examen general</h2><p class="feedback feedback-error">${escapar(reason)}</p>${back}`;
    }
  }

  function renderIntro(): void {
    const result = state.result?.finalExam ? state.result : null;
    if (result && !state.canStart) return renderResult(result, false);
    root.innerHTML = `
      <h2>Examen general</h2>
      <p class="fexam-lead">Evaluación integral de tu formación: institución, cobranza, comunicación, objeciones, acuerdos, registro, tipificación, Control Next y ofimática.</p>
      <ul class="fexam-facts">
        <li><strong>${state.questionCount}</strong><span>preguntas A, B, C o D</span></li>
        <li><strong>${state.minimumScore}</strong><span>puntos mínimos de 100</span></li>
        <li><strong>1 + 1</strong><span>intento inicial y un reintento que tú activas</span></li>
      </ul>
      <div class="fexam-rules">
        <p><strong>Antes de empezar</strong></p>
        <ul>
          <li>Cada pregunta tiene una sola respuesta correcta.</li>
          <li>Tus respuestas se guardan al marcarlas: si cierras la página, retomas donde ibas.</li>
          <li>Puedes moverte entre preguntas y cambiar tus respuestas hasta enviar.</li>
          <li>Al enviar se califica y el intento queda cerrado. No verás las respuestas correctas durante el examen.</li>
        </ul>
      </div>
      ${state.reviewMode ? '<p class="fexam-note">Ya estás certificado: tu examen general quedó registrado y no se vuelve a presentar.</p>' : ''}
      ${result ? '<p class="fexam-note">Tienes un nuevo intento habilitado. Tu resultado anterior se conserva en tu historial.</p>' : ''}
      <p class="fexam-error" role="alert" ${error ? '' : 'hidden'} id="fexam-error">${escapar(error)}</p>
      ${state.canStart ? `<button type="button" class="primary-action fexam-start" data-start>${state.inProgress ? `Retomar examen (${state.inProgress.answered} de ${state.inProgress.total} respondidas) →` : 'Comenzar el examen →'}</button>` : ''}
      ${back}`;
    root.querySelector('[data-start]')?.addEventListener('click', () => { void start(); });
  }

  async function start(): Promise<void> {
    if (saving) return;
    saving = true;
    error = '';
    try {
      const data = (await api<{ data: { questions: { question: Question; selected: Letter | null }[] } }>('/training/final-exam/start', { method: 'POST', body: '{}' })).data;
      questions = data.questions;
      index = Math.max(0, questions.findIndex((item) => !item.selected));
      saving = false;
      renderQuestion();
    } catch (cause) {
      saving = false;
      error = (cause as Error).message;
      renderIntro();
    }
  }

  const answered = (): number => questions.filter((item) => item.selected).length;

  function renderQuestion(): void {
    const item = questions[index]!;
    const percent = Math.round((answered() / questions.length) * 100);
    root.innerHTML = `
      <div class="fexam-top">
        <span>Pregunta ${index + 1} de ${questions.length}</span>
        <span>${answered()} respondidas</span>
      </div>
      <div class="fexam-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}" aria-label="Avance del examen"><span style="width:${percent}%"></span></div>
      <nav class="fexam-map" aria-label="Ir a una pregunta">${questions.map((q, position) => `<button type="button" data-go="${position}" class="${q.selected ? 'is-answered' : ''}${position === index ? ' is-current' : ''}" aria-label="Pregunta ${position + 1}${q.selected ? ', respondida' : ''}"${position === index ? ' aria-current="step"' : ''}>${position + 1}</button>`).join('')}</nav>
      <article class="fexam-card">
        <p class="fexam-topic">${escapar(item.question.topicLabel)}</p>
        <h3 id="fexam-question" tabindex="-1">${escapar(item.question.prompt)}</h3>
        <fieldset class="fexam-options"><legend class="fexam-hidden">Opciones</legend>
          ${item.question.options.map((option) => `<label class="fexam-option${item.selected === option.letter ? ' is-selected' : ''}"><input type="radio" name="fexam-option" value="${option.letter}"${item.selected === option.letter ? ' checked' : ''}><span class="fexam-letter">${option.letter}</span><span>${escapar(option.text)}</span></label>`).join('')}
        </fieldset>
        <p class="fexam-save" aria-live="polite" data-save>${item.selected ? 'Respuesta guardada.' : ''}</p>
      </article>
      <p class="fexam-error" role="alert" ${error ? '' : 'hidden'}>${escapar(error)}</p>
      <div class="fexam-nav">
        <button type="button" class="secondary-action" data-prev${index === 0 ? ' disabled' : ''}>← Anterior</button>
        ${index === questions.length - 1
          ? '<button type="button" class="primary-action" data-review>Revisar y enviar →</button>'
          : '<button type="button" class="primary-action" data-next>Siguiente →</button>'}
      </div>`;
    root.querySelector<HTMLElement>('#fexam-question')?.focus();
    root.querySelectorAll<HTMLInputElement>('input[name="fexam-option"]').forEach((input) => input.addEventListener('change', () => { void choose(input.value as Letter); }));
    root.querySelector('[data-prev]')?.addEventListener('click', () => { index -= 1; error = ''; renderQuestion(); });
    root.querySelector('[data-next]')?.addEventListener('click', () => { index += 1; error = ''; renderQuestion(); });
    root.querySelector('[data-review]')?.addEventListener('click', renderReview);
    root.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((button) => button.addEventListener('click', () => { index = Number(button.dataset.go); error = ''; renderQuestion(); }));
  }

  // Las respuestas se guardan en orden y cada resultado se aplica a la pregunta que lo originó,
  // aunque la persona ya haya pasado a otra. El envío espera a que terminen los guardados pendientes.
  let saveChain: Promise<unknown> = Promise.resolve();
  async function choose(letter: Letter): Promise<void> {
    const at = index;
    const item = questions[at]!;
    const previous = item.selected;
    item.selected = letter;
    root.querySelectorAll('.fexam-option').forEach((label) => label.classList.toggle('is-selected', label.querySelector<HTMLInputElement>('input')!.value === letter));
    const status = root.querySelector<HTMLElement>('[data-save]');
    if (status) status.textContent = 'Guardando…';
    const request = saveChain.catch(() => undefined).then(() => api('/training/final-exam/answers', { method: 'PUT', body: JSON.stringify({ questionId: item.question.id, option: letter }) }));
    saveChain = request;
    try {
      await request;
      if (item.selected !== letter) return; // se cambió de opción mientras guardaba: la última respuesta es la que cuenta
      error = '';
      if (index === at && status?.isConnected) status.textContent = 'Respuesta guardada.';
      root.querySelector(`[data-go="${at}"]`)?.classList.add('is-answered');
      const counter = root.querySelector('.fexam-top span:last-child');
      if (counter) counter.textContent = `${answered()} respondidas`;
      const percent = Math.round((answered() / questions.length) * 100);
      const bar = root.querySelector<HTMLElement>('.fexam-bar');
      bar?.setAttribute('aria-valuenow', String(percent));
      bar?.querySelector<HTMLElement>('span')?.style.setProperty('width', `${percent}%`);
    } catch (cause) {
      if (item.selected !== letter) return;
      item.selected = previous;
      error = (cause as Error).message;
      if (index === at) renderQuestion();
      else { const box = root.querySelector<HTMLElement>('.fexam-error'); if (box) { box.textContent = `No se pudo guardar la respuesta de la pregunta ${at + 1}. ${error}`; box.hidden = false; } }
    }
  }
  function renderReview(): void {
    const missing = questions.map((item, position) => (item.selected ? null : position + 1)).filter((value): value is number => value !== null);
    root.innerHTML = `
      <h2 id="fexam-review" tabindex="-1">Revisa antes de enviar</h2>
      <p>${answered()} de ${questions.length} preguntas respondidas.</p>
      ${missing.length ? `<div class="eval-notice eval-notice--warn"><strong>Te faltan ${missing.length} ${missing.length === 1 ? 'pregunta' : 'preguntas'}</strong><p>Sin responder: ${missing.join(', ')}. Una pregunta sin responder cuenta como incorrecta.</p></div>` : ''}
      <div class="fexam-confirm">
        <p><strong>Al enviar se cierra este intento.</strong> Si no apruebas, puedes activar un único reintento. Después necesitarás acompañamiento del administrador.</p>
        <label class="fexam-check"><input type="checkbox" data-confirm> Entiendo que no podré cambiar mis respuestas.</label>
      </div>
      <p class="fexam-error" role="alert" ${error ? '' : 'hidden'}>${escapar(error)}</p>
      <div class="fexam-nav">
        <button type="button" class="secondary-action" data-back>← Volver a las preguntas</button>
        <button type="button" class="primary-action" data-submit disabled>Enviar examen</button>
      </div>`;
    root.querySelector<HTMLElement>('#fexam-review')?.focus();
    const submit = root.querySelector<HTMLButtonElement>('[data-submit]')!;
    root.querySelector<HTMLInputElement>('[data-confirm]')!.addEventListener('change', (event) => { submit.disabled = !(event.target as HTMLInputElement).checked; });
    root.querySelector('[data-back]')!.addEventListener('click', () => { index = missing.length ? missing[0]! - 1 : 0; renderQuestion(); });
    submit.addEventListener('click', () => { void send(submit); });
  }

  async function send(button: HTMLButtonElement): Promise<void> {
    if (saving) return;
    saving = true;
    button.disabled = true;
    button.textContent = 'Calificando…';
    try {
      await saveChain.catch(() => undefined); // las respuestas pendientes deben quedar guardadas antes de calificar
      const { result } = (await api<{ data: { result: Result } }>('/training/final-exam/submit', { method: 'POST', body: '{}' })).data;
      questions = []; index = 0;
      state = (await api<{ data: State }>('/training/final-exam')).data;
      saving = false;
      renderResult(result, true);
    } catch (cause) {
      saving = false;
      error = (cause as Error).message;
      renderReview();
    }
  }

  function renderResult(result: Result, fresh: boolean): void {
    const grade = result.finalExam!;
    root.innerHTML = `
      <section class="fexam-result ${grade.passed ? 'is-ok' : 'is-bad'}">
        <div class="fexam-score" aria-hidden="true">${Math.round(grade.score)}<small>/100</small></div>
        <div>
          <h2 id="fexam-result" tabindex="-1">${grade.passed ? '¡Aprobaste el examen general!' : 'Examen general no aprobado'}</h2>
          <p>${grade.correct} de ${grade.total} respuestas correctas · mínimo para aprobar: ${grade.minimumScore} puntos.${result.submittedAt ? ` Presentado el ${escapar(formatDate(result.submittedAt))}` : ''}</p>
          ${statusChip(state.status, state.statusLabel)}
        </div>
      </section>
      ${grade.passed ? '<div id="fexam-welcome" aria-label="Tu bienvenida"><p role="status">Preparando tu bienvenida…</p></div>' : reactivationNotice({ activityId: state.activityId, status: state.status, requestedAt: state.reactivationRequestedAt })}
      <section class="fexam-topics"><h3>Resultado por tema</h3>
        <ul>${grade.topics.map((topic) => `<li><span>${escapar(topic.label)}</span><span class="fexam-topic-bar"><i style="width:${topic.percent}%"></i></span><strong>${topic.correct}/${topic.total}</strong></li>`).join('')}</ul>
      </section>
      <section class="fexam-reco"><h3>Recomendaciones</h3><ul>${grade.recommendations.map((item) => `<li>${escapar(item)}</li>`).join('')}</ul></section>
      <p class="fexam-note">La evaluación está cerrada. Las respuestas no están disponibles después del envío.</p>
      ${back}`;
    bindReactivation(root, () => { void load(); });
    if (grade.passed) {
      const host = root.querySelector<HTMLElement>('#fexam-welcome')!;
      void import('../welcome/team-welcome').then(({ mountTeamWelcome }) => {
        if (root.contains(host)) mountTeamWelcome(host, { backHref });
      }).catch(() => {
        if (root.contains(host)) host.innerHTML = '<p role="alert">No pudimos cargar tu bienvenida.</p><a href="/induccion/certificado">Consultar mi certificado →</a>';
      });
    }
    if (fresh) root.querySelector<HTMLElement>('#fexam-result')?.focus();
  }

  await load();
}
