import { escapar } from '../http';
import { showSelectedCollectionOptions } from './ui';
import { isLowScore, lowScoreAlertHtml } from '../low-score';
import { bindReactivation, reactivationNotice } from '../reactivation';

export type ExamContent = ReturnType<typeof import('../../server/domain/collections-exam').publicExam>;
export type ExamResult = import('../../server/domain/advisor-results').AdvisorDiagnosticResult;
export type ExamDraft = { version: number; sectionIndex: number; answers: Record<string, string>; status: 'in-progress' | 'submitted' };
export type ExamState = {
  required: boolean; enabled: boolean; passed: boolean; presented: boolean; attempts: number; activityId: string | null;
  status: import('../reactivation').EvaluationStatus; statusLabel: string;
  content: ExamContent; lastResult: ExamResult | null; draft: ExamDraft | null;
};
type ExamQuestion = ExamContent['sections'][number]['questions'][number];
type ExamOptions = {
  exam: ExamState; experienced: boolean; theoryLocked: boolean; simulatorRoute: string | null; backHref: string;
  result: ExamResult | null;
  start: () => Promise<ExamDraft>;
  saveSection: (key: string, answers: Record<string, string>) => Promise<ExamDraft>;
  submit: (answers: Record<string, string>) => Promise<void>;
  goTheory: () => void;
};

// Examen diagnóstico del asesor con experiencia: un intento. La navegación exige respuestas completas, nunca
// respuestas correctas. El servidor guarda cada sección sin corregirla y evalúa únicamente el intento terminado.
// Aprobarlo o no, no cambia el camino: después se recorre la teoría y al final se presenta el examen general.
export function mountExam(root: HTMLElement, options: ExamOptions): void {
  const content = options.exam.content;
  const result = options.result ?? (options.exam.presented && !options.exam.enabled ? options.exam.lastResult : null);
  let screen: 'intro' | 'section' | 'ready' | 'result' = result ? 'result' : 'intro';
  let index = 0;
  let saving = false;
  let error = '';
  let answers: Record<string, string> = {};
  const focus = (selector: string) => root.querySelector<HTMLElement>(selector)?.focus();
  const errorHtml = () => error ? `<p id="exam-error" class="collections-submit-error" role="alert" tabindex="-1">${escapar(error)}</p>` : '';
  const assessmentNote = '<p class="collections-exam-note">Evaluación formativa basada en lo enseñado. La redacción se puntúa mediante una rúbrica automática de elementos básicos; el líder debe validar su calidad, las políticas vigentes y la preparación para una gestión real.</p>';

  function introHtml(): string {
    const last = options.exam.lastResult;
    return `<section class="collections-exam-intro"><p class="collections-kicker">DEL CASO A LA DECISIÓN</p><h3 id="exam-title" tabindex="-1">Tu diagnóstico</h3>
      <p>Resuelve situaciones de Camila con lo que ya sabes de cobranzas. Elige cómo actuar y redacta respuestas cortas. Tienes un intento inicial y puedes activar <strong>un único reintento</strong> si no apruebas. El resultado se guarda y luego continúas con la teoría del módulo.</p>
      <ul class="collections-exam-facts"><li><strong>7</strong><span>secciones en orden</span></li><li><strong>100</strong><span>puntos posibles</span></li><li><strong>${content.minScore}</strong><span>mínimo para aprobar</span></li></ul>
      <ol class="collections-exam-outline">${content.sections.map((section) => `<li><span>${escapar(section.title)}</span><strong>${section.points} pts</strong></li>`).join('')}</ol>
      <p>Avanza al responder, aunque tengas dudas. Al continuar se guarda la sección; las respuestas enviadas quedan cerradas. No verás soluciones ni puntajes hasta finalizar.</p>
      <details class="collections-exam-policy"><summary>Criterios de aprobación y errores críticos</summary><p>Resultado «Apto»: al menos ${content.minScore}/100 y ningún error crítico. Son criterios didácticos pendientes de validación interna.</p><ul>${content.criticalRules.map((rule) => `<li>${escapar(rule)}</li>`).join('')}</ul></details>
      ${assessmentNote}
      ${last ? `<p class="collections-exam-last">Intento anterior: ${last.score}/100 · ${escapar(last.verdict)}. Tienes un nuevo intento habilitado.</p>` : ''}
      ${errorHtml()}<div class="collections-actions"><button type="button" data-exam-start class="collections-primary"${saving ? ' disabled' : ''}>${saving ? 'Abriendo…' : options.exam.draft ? 'Retomar evaluación →' : 'Comenzar evaluación →'}</button></div></section>`;
  }

  function questionHtml(question: ExamQuestion, position: number): string {
    const id = `exam-${question.key}`;
    const label = `<span>${position + 1}. ${escapar(question.prompt)}</span><small>${question.points} puntos</small>`;
    if (question.kind === 'text') return `<label class="collections-exam-written" for="${id}">${label}<textarea id="${id}" data-exam-field="${question.key}" rows="4" maxlength="${question.maxLength}" required placeholder="Escribe lo que le dirías al cliente…"${saving ? ' disabled' : ''}>${escapar(answers[question.key] ?? '')}</textarea><span class="collections-exam-help">Respuesta breve · Máximo ${question.maxLength} caracteres.</span></label>`;
    if (question.kind === 'select') return `<label class="collections-exam-written" for="${id}">${label}<select id="${id}" data-exam-field="${question.key}" required${saving ? ' disabled' : ''}><option value="">Selecciona tu respuesta</option>${question.options!.map((option) => `<option value="${option.id}"${answers[question.key] === option.id ? ' selected' : ''}>${escapar(option.text)}</option>`).join('')}</select></label>`;
    return `<fieldset class="collections-exam-selection"><legend>${label}</legend>${question.options!.map((option) => `<label><input type="radio" name="${question.key}" data-exam-field="${question.key}" value="${option.id}" required${answers[question.key] === option.id ? ' checked' : ''}${saving ? ' disabled' : ''}><span>${escapar(option.text)}</span></label>`).join('')}</fieldset>`;
  }

  function sectionHtml(): string {
    const section = content.sections[index];
    return `<section class="collections-exam-section"><div class="collections-exam-top"><span>Sección ${index + 1} de 7</span><span>${section.points} puntos</span></div>
      <ol class="collections-exam-stages" aria-label="Secciones de la evaluación">${content.sections.map((item, position) => `<li class="${position < index ? 'is-complete' : position === index ? 'is-current' : ''}"${position === index ? ' aria-current="step"' : ''} aria-label="${escapar(item.title)}: ${position < index ? 'guardada' : position === index ? 'actual' : 'bloqueada'}">${position < index ? '✓' : position + 1}</li>`).join('')}</ol>
      <h3 id="exam-section-title" tabindex="-1">${escapar(section.title)}</h3><div class="collections-exam-scenario"><span>CASO FICTICIO · CAMILA ROJAS</span><p>${escapar(section.situation)}</p></div>
      <form data-exam-section>${section.questions.map(questionHtml).join('')}${errorHtml()}<p class="collections-exam-help">Solo se comprueba que respondas. La calificación se realiza al terminar las siete secciones.</p><button type="submit" data-exam-next class="collections-primary"${saving || !section.questions.every((q) => answers[q.key]?.trim()) ? ' disabled' : ''}>${saving ? 'Guardando…' : index === 6 ? 'Guardar sección y finalizar →' : 'Guardar y continuar →'}</button></form></section>`;
  }

  function readyHtml(): string {
    return `<section class="collections-exam-intro"><h3 id="exam-title" tabindex="-1">Tus siete secciones están guardadas</h3><p>Envía el examen para conocer tu resultado. Aún no se ha calificado ni contado este intento.</p><details class="collections-exam-policy"><summary>Consultar mis respuestas</summary>${content.sections.map((section) => `<h4>${escapar(section.title)}</h4>${section.questions.map((q) => `<p><strong>${escapar(q.prompt)}</strong><br>${escapar(q.kind === 'text' ? answers[q.key] : q.options?.find((o) => o.id === answers[q.key])?.text ?? '')}</p>`).join('')}`).join('')}</details>${errorHtml()}<div class="collections-actions"><button type="button" data-exam-submit class="collections-primary"${saving ? ' disabled' : ''}>${saving ? 'Evaluando…' : 'Enviar evaluación →'}</button></div></section>`;
  }

  function resultHtml(): string {
    const data = result!;
    return `<section class="collections-exam-result ${data.passed ? 'is-correct' : 'is-wrong'}"><div class="collections-exam-score" aria-hidden="true">${data.score}<small>/100</small></div><h3 id="exam-title" tabindex="-1">${escapar(data.verdict)}</h3>
      ${isLowScore(data.score) ? lowScoreAlertHtml('el examen final') : ''}
      <p role="status">${data.passed ? 'Alcanzaste los requisitos de esta evaluación.' : `Necesitas al menos ${data.minScore}/100 y cumplir los criterios de la evaluación. Repasa las lecciones de los temas con menor puntaje.`}</p>
      <div class="collections-exam-breakdown"><table><caption>Puntaje por sección</caption><thead><tr><th scope="col">Sección</th><th scope="col">Puntaje</th></tr></thead><tbody>${data.sections.map((section) => `<tr><th scope="row">${escapar(section.title)}</th><td>${section.score}/${section.maxScore}</td></tr>`).join('')}</tbody></table></div>
      <div class="collections-exam-feedback"><section><h4>Fortalezas</h4>${data.strengths.length ? `<ul>${data.strengths.map((s) => `<li>${escapar(s)}</li>`).join('')}</ul>` : '<p>Aún necesitas practicar las decisiones de los casos.</p>'}</section><section><h4>Para mejorar</h4>${data.improvements.length ? `<ul>${data.improvements.map((s) => `<li>${escapar(s)}</li>`).join('')}</ul>` : '<p>Mantén estas prácticas y valida su aplicación con tu líder.</p>'}</section></div>
      ${assessmentNote}
      <p class="collections-exam-note">La evaluación está cerrada. Las respuestas no están disponibles después del envío.</p>
      <p class="collections-exam-note">Este es un examen diagnóstico: su resultado queda registrado para tu líder, pero no reemplaza la teoría ni el examen general.</p>
      ${!data.passed && options.exam.activityId ? reactivationNotice({ activityId: options.exam.activityId, status: options.exam.status }) : ''}
      ${errorHtml()}<div class="collections-actions"><button type="button" data-exam-theory class="collections-primary">Continuar con la teoría →</button>${options.exam.enabled ? `<button type="button" data-exam-start class="collections-secondary">${options.exam.draft ? 'Retomar intento autorizado' : 'Presentar el intento autorizado'}</button>` : ''}</div></section>`;
  }

  function render(): void {
    root.innerHTML = screen === 'intro' ? introHtml() : screen === 'section' ? sectionHtml() : screen === 'ready' ? readyHtml() : resultHtml();
    bindReactivation(root, () => location.reload());
    root.querySelectorAll('[data-exam-start]').forEach((button) => button.addEventListener('click', async () => {
      if (saving) return;
      saving = true; error = ''; (button as HTMLButtonElement).disabled = true;
      try {
        const draft = await options.start(); options.exam.draft = draft;
        answers = { ...draft.answers }; index = draft.sectionIndex; screen = index === content.sections.length ? 'ready' : 'section';
      } catch (cause) { error = (cause as Error).message; }
      saving = false; render(); focus(error ? '#exam-error' : screen === 'section' ? '#exam-section-title' : '#exam-title');
    }));
    root.querySelector('[data-exam-theory]')?.addEventListener('click', options.goTheory);
    root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-exam-field]').forEach((field) => field.addEventListener('input', () => {
      answers[field.dataset.examField!] = field.value;
      const next = root.querySelector<HTMLButtonElement>('[data-exam-next]');
      if (next) next.disabled = saving || !content.sections[index].questions.every((q) => answers[q.key]?.trim());
    }));
    root.querySelector('[data-exam-section]')?.addEventListener('submit', async (event) => {
      event.preventDefault(); if (saving) return;
      const section = content.sections[index];
      if (!section.questions.every((q) => answers[q.key]?.trim())) return;
      saving = true; error = ''; render();
      try {
        const draft = await options.saveSection(section.key, Object.fromEntries(section.questions.map((q) => [q.key, answers[q.key]])));
        options.exam.draft = draft; answers = { ...draft.answers }; index = draft.sectionIndex;
        screen = index === content.sections.length ? 'ready' : 'section';
      } catch (cause) { error = (cause as Error).message; }
      saving = false; render(); focus(error ? '#exam-error' : screen === 'section' ? '#exam-section-title' : '#exam-title');
    });
    root.querySelector('[data-exam-submit]')?.addEventListener('click', async () => {
      if (saving) return;
      saving = true; error = ''; render();
      try { await options.submit({ ...answers }); }
      catch (cause) { saving = false; error = (cause as Error).message; render(); focus('#exam-error'); }
    });
    showSelectedCollectionOptions(root);
  }
  render();
}
