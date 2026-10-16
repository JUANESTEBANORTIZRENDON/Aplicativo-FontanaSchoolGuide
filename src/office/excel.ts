import { escapar } from '../http';
import { isLowScore, lowScoreAlertHtml } from '../low-score';
import { ApiError, officeApi, type ExcelPractice, type ExcelResult, type Lesson, type QuizOptionId, type QuizQuestion } from './api';
import { bundledAsset, errorMessage, lessonCard, loadingScreen, showError, type OfficeContext } from './office';

// Excel para cobranzas: cuatro microlecciones y una evaluación de opción múltiple (A–D) con casos ilustrados.
// El servidor califica; aquí solo se recogen las respuestas y se muestra la retroalimentación.

export async function renderExcel(ctx: OfficeContext): Promise<void> {
  const section = ctx.state.sections.find((item) => item.key === 'excel')!;
  const cfg = ctx.state.config.excel;
  if (section.status === 'COMPLETED') {
    ctx.view.innerHTML = `
      <section class="office-card">
        <p class="eyebrow">EXCEL PARA COBRANZAS</p><h1>Evaluación de Excel aprobada</h1>
        <p class="office-lead">Ya superaste los ${cfg.minScore} puntos de la evaluación.</p>
        <div class="office-actions"><button class="primary" id="excel-next" type="button">Continuar con Ortografía →</button>${REVIEW_BUTTON}</div>
      </section>`;
    ctx.view.querySelector('#excel-next')!.addEventListener('click', () => ctx.go('ortografia'));
    bindReview(ctx);
    return;
  }
  if (section.status === 'NO_ATTEMPTS') {
    ctx.view.innerHTML = `<section class="office-card"><p class="eyebrow">EXCEL PARA COBRANZAS</p><h1>Sin intentos disponibles</h1><p class="office-error">Agotaste los intentos de la evaluación. Solicita una reactivación al administrador.</p>
      <p class="office-lead">Mientras tanto puedes repasar las lecciones.</p>
      <div class="office-actions">${REVIEW_BUTTON}<a class="office-secondary" href="${escapar(ctx.backHref)}">Volver a tu ruta de formación</a></div></section>`;
    bindReview(ctx);
    return;
  }
  const activity = await officeApi.excelActivity();
  // Un intento abierto se reanuda con las mismas preguntas.
  if (activity.attemptId && activity.questions) {
    renderQuiz(ctx, activity.id, { attemptId: activity.attemptId, number: 0, resumed: true, title: activity.title, questions: activity.questions });
    return;
  }
  renderLessons(ctx, activity.id, activity.lessons);
}

// Repaso: con la práctica aprobada o sin intentos, las lecciones se pueden volver a leer.
const REVIEW_BUTTON = '<button class="office-secondary" id="excel-review" type="button">Repasar las lecciones</button>';

function bindReview(ctx: OfficeContext): void {
  const button = ctx.view.querySelector<HTMLButtonElement>('#excel-review');
  button?.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const { lessons } = await officeApi.content<{ lessons: Lesson[] }>('excel');
      renderLessons(ctx, null, lessons);
    } catch (error) {
      button.disabled = false;
      showError(ctx.view, error);
    }
  });
}

// activityId null = modo repaso: se recorren las lecciones desde la primera y al final se vuelve al resumen.
function renderLessons(ctx: OfficeContext, activityId: string | null, lessons: Lesson[]): void {
  const section = ctx.state.sections.find((item) => item.key === 'excel')!;
  const cfg = ctx.state.config.excel;
  const review = activityId === null;
  const viewed = new Set(section.lessonsViewed);
  let index = review ? 0 : Math.min(lessons.findIndex((lesson) => !viewed.has(lesson.key)), lessons.length - 1);
  if (index < 0) index = 0;

  const draw = () => {
    const lesson = lessons[index]!;
    void officeApi.view(lesson.key).then(() => viewed.add(lesson.key)).catch(() => undefined);
    ctx.view.innerHTML = `
      <section class="office-card" aria-labelledby="excel-title">
        <p class="eyebrow">EXCEL PARA COBRANZAS · ${review ? 'REPASO · ' : ''}LECCIÓN ${index + 1} DE ${lessons.length}</p>
        <h1 id="excel-title">${escapar(lesson.title)}</h1>
        ${lessonCard(lesson)}
        <p class="office-note">La evaluación final es de opción múltiple, vale 100 puntos y se aprueba con ${cfg.minScore}.</p>
        <div class="office-actions">
          <button class="office-secondary" id="lesson-prev" type="button" ${index === 0 ? 'disabled' : ''}>← Anterior</button>
          ${index < lessons.length - 1
            ? '<button class="primary" id="lesson-next" type="button">Siguiente lección →</button>'
            : review
              ? '<button class="primary" id="lesson-done" type="button">Terminar repaso</button>'
              : '<button class="primary" id="lesson-practice" type="button">Ir a la evaluación →</button>'}
        </div>
      </section>`;
    ctx.view.querySelector('#lesson-prev')!.addEventListener('click', () => { index -= 1; draw(); });
    ctx.view.querySelector('#lesson-next')?.addEventListener('click', () => { index += 1; draw(); });
    ctx.view.querySelector('#lesson-done')?.addEventListener('click', () => void renderExcel(ctx).catch((error) => showError(ctx.view, error)));
    const start = ctx.view.querySelector<HTMLButtonElement>('#lesson-practice');
    start?.addEventListener('click', async () => {
      start.disabled = true;
      start.textContent = 'Preparando la evaluación…';
      const hide = loadingScreen('Preparando tu evaluación…');
      try {
        const practice = await officeApi.excelStart(activityId!);
        hide();
        renderQuiz(ctx, activityId!, practice);
      } catch (error) {
        hide();
        start.disabled = false;
        start.textContent = 'Ir a la evaluación →';
        showError(ctx.view, error);
      }
    });
  };
  draw();
}

const LETTER: Record<QuizOptionId, string> = { a: 'A', b: 'B', c: 'C', d: 'D' };

// Evaluación de opción múltiple: cada pregunta trae un caso ilustrado y cuatro opciones.
function renderQuiz(ctx: OfficeContext, activityId: string, practice: ExcelPractice): void {
  const cfg = ctx.state.config.excel;
  const section = ctx.state.sections.find((item) => item.key === 'excel')!;
  const questions = practice.questions;
  ctx.view.innerHTML = `
    <section class="office-card" aria-labelledby="excel-title">
      <p class="eyebrow">EXCEL PARA COBRANZAS · EVALUACIÓN</p>
      <h1 id="excel-title">${escapar(practice.title)}</h1>
      <p class="office-lead">Lee cada caso, mira la imagen y elige una opción. Son ${questions.length} preguntas; se aprueba con ${cfg.minScore} puntos de 100.</p>
      <ul class="office-goals"><li><strong>Intentos:</strong> te quedan ${section.attemptsRemaining ?? cfg.maxAttempts} de ${section.maxAttempts ?? cfg.maxAttempts}.</li></ul>
      <form id="excel-quiz" class="quiz">
        ${questions.map((question, index) => {
          const image = bundledAsset(`excel-${question.image}`);
          return `<fieldset class="quiz-question">
            <legend><span class="quiz-number">${index + 1}</span>${escapar(question.prompt)}</legend>
            ${image ? `<img class="quiz-image office-zoomable" title="Haz clic para ampliar" src="${escapar(image)}" alt="Caso de la pregunta ${index + 1} en una hoja de Excel" width="1280" height="720" loading="lazy" decoding="async">` : ''}
            <div class="quiz-options">
              ${question.options.map((option) => `<label class="quiz-option"><input type="radio" name="${question.id}" value="${option.id}" required><span class="quiz-letter">${LETTER[option.id]}</span><span>${escapar(option.text)}</span></label>`).join('')}
            </div>
          </fieldset>`;
        }).join('')}
        <p id="excel-progress" class="office-note" role="status"></p>
        <div class="office-actions"><button class="primary" id="excel-submit" type="submit">Enviar evaluación</button></div>
      </form>
    </section>`;
  const form = ctx.view.querySelector<HTMLFormElement>('#excel-quiz')!;
  const progress = ctx.view.querySelector<HTMLElement>('#excel-progress')!;
  const submit = ctx.view.querySelector<HTMLButtonElement>('#excel-submit')!;
  const answered = () => questions.filter((question) => form.querySelector(`input[name="${question.id}"]:checked`)).length;
  const update = () => { progress.textContent = `Respondidas: ${answered()} de ${questions.length}.`; };
  form.addEventListener('change', update);
  update();
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (answered() < questions.length) {
      progress.textContent = `Te faltan ${questions.length - answered()} pregunta(s) por responder.`;
      form.querySelector<HTMLElement>('.quiz-question:has(input:required:invalid)')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const answers = questions.map((question) => ({ questionId: question.id, optionId: form.querySelector<HTMLInputElement>(`input[name="${question.id}"]:checked`)!.value as QuizOptionId }));
    submit.disabled = true;
    submit.textContent = 'Calificando…';
    const hide = loadingScreen('Calificando tu evaluación…', 'Revisamos tus respuestas y preparamos las explicaciones.');
    try {
      const result = await officeApi.excelSubmit(activityId, { attemptId: practice.attemptId, answers });
      await ctx.refresh();
      hide();
      renderResult(ctx, activityId, result, questions);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      hide();
      if (error instanceof ApiError && error.code === 'ATTEMPT_CLOSED') { await ctx.reload(); return; }
      submit.disabled = false;
      submit.textContent = 'Enviar evaluación';
      showError(ctx.view, error);
    }
  });
}

function renderResult(ctx: OfficeContext, activityId: string, result: ExcelResult, questions: QuizQuestion[]): void {
  const byId = new Map(questions.map((question) => [question.id, question]));
  const optionText = (question: QuizQuestion | undefined, id: string | null) => {
    const option = question?.options.find((item) => item.id === id);
    return option ? `${LETTER[option.id]}. ${option.text}` : 'Sin responder';
  };
  ctx.view.innerHTML = `
    <section class="office-card" aria-labelledby="excel-result-title">
      <p class="eyebrow">EXCEL PARA COBRANZAS · INTENTO ${result.attemptNumber || ''}</p>
      <h1 id="excel-result-title">${result.passed ? '¡Evaluación aprobada!' : 'Todavía no alcanzas el puntaje'}</h1>
      ${isLowScore(result.score) ? lowScoreAlertHtml('la evaluación de Excel') : ''}
      <div class="office-metrics">
        <div><strong>${result.score.toFixed(0)}</strong><span>puntos de 100</span><small>Mínimo: ${result.minScore}</small></div>
        <div><strong>${result.steps.filter((step) => step.correct).length} / ${result.steps.length}</strong><span>respuestas correctas</span></div>
      </div>
      <ol class="office-feedback">
        ${result.steps.map((step) => {
          const question = byId.get(step.questionId);
          return `<li data-ok="${step.correct}"><strong>${step.correct ? '✓' : '✗'} ${escapar(question?.prompt ?? step.questionId)}</strong>
            <span>Tu respuesta: ${escapar(optionText(question, step.chosen))}${step.correct ? '' : ` · Correcta: ${escapar(optionText(question, step.correctOption))}`}</span>
            <span>${escapar(step.feedback)}</span></li>`;
        }).join('')}
      </ol>
      <div class="office-actions">
        ${result.passed ? '<button class="primary" id="excel-next" type="button">Continuar con Ortografía →</button>'
          : result.attemptsRemaining ? `<button class="primary" id="excel-retry" type="button">Intentar de nuevo (${result.attemptsRemaining} restantes)</button>`
            : '<p class="office-error">Agotaste los intentos. Solicita una reactivación al administrador.</p>'}
        ${REVIEW_BUTTON}
      </div>
    </section>`;
  ctx.view.querySelector('#excel-next')?.addEventListener('click', () => ctx.go('ortografia'));
  bindReview(ctx);
  const retry = ctx.view.querySelector<HTMLButtonElement>('#excel-retry');
  retry?.addEventListener('click', async () => {
    retry.disabled = true;
    try {
      renderQuiz(ctx, activityId, await officeApi.excelStart(activityId));
    } catch (error) {
      retry.disabled = false;
      ctx.view.insertAdjacentHTML('afterbegin', `<p class="office-error" role="alert">${escapar(errorMessage(error))}</p>`);
    }
  });
}
