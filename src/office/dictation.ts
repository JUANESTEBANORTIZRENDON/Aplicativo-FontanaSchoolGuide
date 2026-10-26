import { escapar } from '../http';
import { isLowScore, lowScoreAlertHtml } from '../low-score';
import { ApiError, officeApi, type DictationInfo, type DictationResult, type Lesson } from './api';
import { errorMessage, lessonCard, loadingScreen, showError, type OfficeContext } from './office';

// Ortografía aplicada: lecciones cortas y un dictado. La nota la calcula el sistema experto del servidor;
// las recomendaciones (con Ollama o por plantilla) llegan ya redactadas junto con el resultado.

const BLOCKED_INPUT = ['insertFromPaste', 'insertFromDrop', 'insertReplacementText'];

function lockPasting(element: HTMLElement): void {
  for (const type of ['paste', 'cut', 'copy', 'drop', 'dragstart', 'contextmenu']) element.addEventListener(type, (event) => event.preventDefault());
  element.addEventListener('beforeinput', (event) => {
    if (BLOCKED_INPUT.includes((event as InputEvent).inputType)) event.preventDefault();
  });
}

export async function renderDictation(ctx: OfficeContext): Promise<void> {
  const section = ctx.state.sections.find((item) => item.key === 'ortografia')!;
  const cfg = ctx.state.config.dictation;
  if (section.status === 'COMPLETED') {
    ctx.view.innerHTML = `
      <section class="office-card">
        <p class="eyebrow">ORTOGRAFÍA APLICADA</p><h1>${section.alert ? 'Dictado presentado' : 'Dictado aprobado'}</h1>
        <p class="office-lead">${section.alert
          ? 'Tu dictado quedó registrado. Tu ortografía necesita refuerzo: repasa las lecciones, sobre todo las de palabras que suenan igual y las tildes.'
          : `Superaste los ${cfg.minScore} puntos sin errores críticos.`}</p>
        <div class="office-actions"><button class="primary" id="dictation-next" type="button">Ver mi resultado y sello →</button>${REVIEW_BUTTON}</div>
      </section>`;
    ctx.view.querySelector('#dictation-next')!.addEventListener('click', () => ctx.go('resultado'));
    bindReview(ctx);
    return;
  }
  if (section.status === 'NO_ATTEMPTS') {
    ctx.view.innerHTML = `<section class="office-card"><p class="eyebrow">ORTOGRAFÍA APLICADA</p><h1>Sin intentos disponibles</h1><p class="office-error">Agotaste los intentos del dictado. Solicita una reactivación al administrador.</p>
      <p class="office-lead">Mientras tanto puedes repasar las lecciones.</p>
      <div class="office-actions">${REVIEW_BUTTON}<a class="office-secondary" href="${escapar(ctx.backHref)}">Volver a tu ruta de formación</a></div></section>`;
    bindReview(ctx);
    return;
  }
  const { lessons } = await officeApi.content<{ lessons: Lesson[] }>('ortografia');
  const viewed = new Set(section.lessonsViewed);
  // Quien ya vio todas las lecciones (o tiene un dictado abierto) entra directo al ejercicio.
  if (lessons.every((lesson) => viewed.has(lesson.key)) || ctx.state.dictation?.attemptId) {
    renderExercise(ctx);
    return;
  }
  renderLessons(ctx, lessons, viewed);
}

// Repaso: las lecciones se pueden volver a leer en cualquier momento (aprobado, sin intentos o antes del dictado).
const REVIEW_BUTTON = '<button class="office-secondary" id="orto-review" type="button">Repasar las lecciones</button>';

function bindReview(ctx: OfficeContext): void {
  const button = ctx.view.querySelector<HTMLButtonElement>('#orto-review');
  button?.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const { lessons } = await officeApi.content<{ lessons: Lesson[] }>('ortografia');
      renderLessons(ctx, lessons, new Set(), true);
    } catch (error) {
      button.disabled = false;
      showError(ctx.view, error);
    }
  });
}

function renderLessons(ctx: OfficeContext, lessons: Lesson[], viewed: Set<string>, review = false): void {
  let index = review ? 0 : Math.max(0, lessons.findIndex((lesson) => !viewed.has(lesson.key)));
  const draw = () => {
    const lesson = lessons[index]!;
    void officeApi.view(lesson.key).then(() => viewed.add(lesson.key)).catch(() => undefined);
    ctx.view.innerHTML = `
      <section class="office-card" aria-labelledby="orto-title">
        <p class="eyebrow">ORTOGRAFÍA APLICADA · ${review ? 'REPASO · ' : ''}LECCIÓN ${index + 1} DE ${lessons.length}</p>
        <h1 id="orto-title">${escapar(lesson.title)}</h1>
        ${lessonCard(lesson)}
        <div class="office-actions">
          <button class="office-secondary" id="lesson-prev" type="button" ${index === 0 ? 'disabled' : ''}>← Anterior</button>
          ${index < lessons.length - 1
            ? '<button class="primary" id="lesson-next" type="button">Siguiente lección →</button>'
            : review
              ? '<button class="primary" id="lesson-done" type="button">Terminar repaso</button>'
              : '<button class="primary" id="lesson-exercise" type="button">Ir al dictado →</button>'}
        </div>
      </section>`;
    ctx.view.querySelector('#lesson-done')?.addEventListener('click', () => void renderDictation(ctx).catch((error) => showError(ctx.view, error)));
    ctx.view.querySelector('#lesson-prev')!.addEventListener('click', () => { index -= 1; draw(); });
    ctx.view.querySelector('#lesson-next')?.addEventListener('click', () => { index += 1; draw(); });
    ctx.view.querySelector('#lesson-exercise')?.addEventListener('click', () => renderExercise(ctx));
  };
  draw();
}

function renderExercise(ctx: OfficeContext): void {
  const cfg = ctx.state.config.dictation;
  const exercise: DictationInfo | null = ctx.state.dictation;
  if (!exercise) {
    ctx.view.innerHTML = `
      <section class="office-card">
        <p class="eyebrow">ORTOGRAFÍA APLICADA · DICTADO</p><h1>El dictado estará disponible pronto</h1>
        <p class="office-lead">Todavía no hay un ejercicio con audio autorizado. Vuelve más tarde; tu avance queda guardado.</p>
        <div class="office-actions">${REVIEW_BUTTON}<a class="office-secondary" href="${escapar(ctx.backHref)}">Volver a tu ruta de formación</a></div>
      </section>`;
    bindReview(ctx);
    return;
  }
  ctx.view.innerHTML = `
    <section class="office-card" aria-labelledby="dictation-title">
      <p class="eyebrow">ORTOGRAFÍA APLICADA · DICTADO</p>
      <h1 id="dictation-title">${escapar(exercise.title)}</h1>
      <p class="office-lead">Escucha la observación y escríbela tal como la dirías en una gestión de cobranza. Puedes reproducirla hasta ${cfg.maxPlays} veces.</p>
      <ul class="office-goals">
        <li><strong>Un solo intento:</strong> el dictado mide tu ortografía. Revisa bien antes de enviar.</li>
        <li><strong>Reproducciones:</strong> puedes escucharlo hasta ${cfg.maxPlays} veces para corregir lo que escribiste.</li>
        <li><strong>Meta de ortografía:</strong> ${cfg.minScore} puntos y ningún error crítico. Si no la alcanzas, verás tus correcciones y podrás seguir con el módulo.</li>
        ${exercise.devTts ? '<li><strong>Audio de prueba:</strong> este ejercicio se reproduce con la voz del navegador porque todavía no tiene audio autorizado.</li>' : ''}
      </ul>
      <div class="office-actions"><button class="primary" id="dictation-begin" type="button">Iniciar dictado</button>${REVIEW_BUTTON}</div>
    </section>`;
  bindReview(ctx);
  const begin = ctx.view.querySelector<HTMLButtonElement>('#dictation-begin')!;
  begin.addEventListener('click', async () => {
    begin.disabled = true;
    begin.textContent = 'Preparando…';
    try {
      const started = await officeApi.dictationStart(exercise.id);
      renderRunning(ctx, exercise, started.attemptId, started.playsRemaining);
    } catch (error) {
      begin.disabled = false;
      begin.textContent = 'Iniciar dictado';
      showError(ctx.view, error);
    }
  });
}

function renderRunning(ctx: OfficeContext, exercise: DictationInfo, attemptId: string, initialPlays: number): void {
  const cfg = ctx.state.config.dictation;
  ctx.view.innerHTML = `
    <section class="office-card" aria-labelledby="dictation-title">
      <p class="eyebrow">ORTOGRAFÍA APLICADA · DICTADO</p>
      <h1 id="dictation-title">${escapar(exercise.title)}</h1>
      ${exercise.devTts ? '<p class="office-warning" role="note"><strong>Audio de prueba:</strong> se reproduce con la voz del navegador.</p>' : ''}
      <div class="office-dictation-player">
        <button class="primary" id="dictation-play" type="button">▶ Reproducir</button>
        <span id="dictation-plays" role="status">Reproducciones restantes: ${initialPlays} de ${cfg.maxPlays}</span>
      </div>
      <label class="office-label" for="dictation-input">Escribe lo que escuchas</label>
      <textarea id="dictation-input" class="office-typing-input" rows="6" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea>
      <p class="office-note">Cuida las tildes, las mayúsculas y los signos. No se puede pegar texto.</p>
      <div class="office-actions"><button class="primary" id="dictation-submit" type="button">Enviar dictado</button></div>
    </section>`;
  const play = ctx.view.querySelector<HTMLButtonElement>('#dictation-play')!;
  const plays = ctx.view.querySelector<HTMLElement>('#dictation-plays')!;
  const input = ctx.view.querySelector<HTMLTextAreaElement>('#dictation-input')!;
  const submit = ctx.view.querySelector<HTMLButtonElement>('#dictation-submit')!;
  lockPasting(input);
  let remaining = initialPlays;
  let playing = false;
  if (remaining === 0) { play.disabled = true; }
  const setRemaining = (value: number) => {
    remaining = value;
    plays.textContent = `Reproducciones restantes: ${value} de ${cfg.maxPlays}`;
    play.disabled = playing || value <= 0;
  };

  play.addEventListener('click', async () => {
    if (playing || remaining <= 0) return;
    playing = true;
    play.disabled = true;
    try {
      const response = await officeApi.dictationPlay(exercise.id, attemptId);
      setRemaining(response.playsRemaining);
      const done = () => { playing = false; play.disabled = remaining <= 0; play.textContent = '▶ Reproducir'; };
      play.textContent = 'Reproduciendo…';
      if (response.mode === 'audio') {
        const audio = new Audio(response.url);
        audio.addEventListener('ended', done);
        audio.addEventListener('error', () => { done(); showError(ctx.view, new Error('No se pudo reproducir el audio. Revisa tu conexión.')); });
        await audio.play();
      } else {
        const utterance = new SpeechSynthesisUtterance(response.text);
        utterance.lang = 'es-CO';
        utterance.addEventListener('end', done);
        utterance.addEventListener('error', done);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      }
    } catch (error) {
      playing = false;
      play.disabled = remaining <= 0;
      play.textContent = '▶ Reproducir';
      showError(ctx.view, error);
      if (error instanceof ApiError && error.code === 'PLAYS_EXHAUSTED') setRemaining(0);
    }
  });

  let sent = false;
  submit.addEventListener('click', async () => {
    if (sent) return;
    if (!input.value.trim()) { showError(ctx.view, new Error('Escribe lo que escuchas antes de enviar.')); return; }
    sent = true;
    submit.disabled = true;
    submit.textContent = 'Calificando…';
    const hide = loadingScreen('Revisando tu dictado…', 'Comparamos palabra por palabra y preparamos tus recomendaciones.');
    try {
      const result = await officeApi.dictationSubmit(exercise.id, { attemptId, typedText: input.value });
      await ctx.refresh().catch(() => undefined);
      hide();
      renderResult(ctx, result);
    } catch (error) {
      hide();
      sent = false;
      submit.disabled = false;
      submit.textContent = 'Enviar dictado';
      showError(ctx.view, error);
    }
  });
}

function renderResult(ctx: OfficeContext, result: DictationResult): void {
  const rec = result.recommendation;
  ctx.view.innerHTML = `
    <section class="office-card" aria-labelledby="dictation-result-title">
      <p class="eyebrow">ORTOGRAFÍA APLICADA · INTENTO ${result.attemptNumber}</p>
      <h1 id="dictation-result-title">${result.passed ? '¡Dictado aprobado!' : 'Dictado presentado: tu ortografía necesita refuerzo'}</h1>
      ${result.passed ? '' : '<p class="office-warning" role="note">Puedes continuar con el módulo. Repasa las lecciones de ortografía.</p>'}
      ${isLowScore(result.score) ? lowScoreAlertHtml('el dictado de ortografía') : ''}
      <div class="office-metrics">
        <div><strong>${result.score.toFixed(0)}</strong><span>puntos de 100</span><small>Mínimo: ${result.minScore}</small></div>
        <div><strong>${result.criticalCount}</strong><span>errores críticos</span><small>Para aprobar: ninguno</small></div>
        <div><strong>${result.wordMatchPercent.toFixed(0)} %</strong><span>palabras acertadas</span></div>
      </div>
      <p class="office-note">El dictado está cerrado. El texto enviado y su corrección no están disponibles después del envío.</p>
      <div class="office-recommendation">
        <h2>Recomendaciones para ti</h2>
        <p>${escapar(rec.resumen)}</p>
        ${rec.fortalezas.length ? `<h3>Lo que hiciste bien</h3><ul>${rec.fortalezas.map((item) => `<li>${escapar(item)}</li>`).join('')}</ul>` : ''}
        ${rec.recomendaciones.length ? `<h3>Para reforzar</h3><ul>${rec.recomendaciones.map((item) => `<li>${escapar(item)}</li>`).join('')}</ul>` : ''}
        <p><strong>Próximo paso:</strong> ${escapar(rec.proximoPaso)}</p>
      </div>
      <div class="office-actions">
        <button class="primary" id="dictation-next" type="button">Ver mi resultado y sello →</button>
        ${REVIEW_BUTTON}
      </div>
    </section>`;
  ctx.view.querySelector('#dictation-next')?.addEventListener('click', () => ctx.go('resultado'));
  bindReview(ctx);
  const retry = ctx.view.querySelector<HTMLButtonElement>('#dictation-retry');
  retry?.addEventListener('click', async () => {
    retry.disabled = true;
    try {
      await ctx.reload();
    } catch (error) {
      retry.disabled = false;
      ctx.view.insertAdjacentHTML('afterbegin', `<p class="office-error" role="alert">${escapar(errorMessage(error))}</p>`);
    }
  });
}
