import { escapar } from '../http';
import { isLowScore, lowScoreAlertHtml } from '../low-score';

export type ExamQuestion = { key: string; prompt: string; block: string; options: { id: string; text: string }[] };
export type ExamResult = { passed: boolean; correctCount: number; total: number; minCorrect: number; results: { key: string; block: string; correct: boolean; selected: string; correctOption: string; feedback: string }[] };
export type ExamState = { enabled: boolean; passed: boolean; attempts: number; content: { minCorrect: number; total: number; questions: ExamQuestion[] }; lastResult: ExamResult | null };

type ExamOptions = {
  exam: ExamState;
  experienced: boolean;
  theoryRequired: boolean;
  simulatorRoute: string | null;
  backHref: string;
  blockTitles: Record<string, string>;
  // Resultado recién enviado: el contenedor vuelve a montar el examen para mostrarlo.
  result: ExamResult | null;
  submit: (answers: Record<string, string>) => Promise<void>;
  goTheory: () => void;
};

// Examen final: una pregunta a la vez, sin corrección hasta enviarlo completo.
export function mountExam(root: HTMLElement, options: ExamOptions): void {
  const content = options.exam.content;
  const questions = content.questions;
  const result: ExamResult | null = options.result ?? (options.exam.passed ? options.exam.lastResult : null);
  let screen: 'intro' | 'question' | 'result' = result ? 'result' : 'intro';
  let index = 0;
  let saving = false;
  let error = '';
  const answers: Record<string, string> = {};

  function introHtml(): string {
    const last = options.exam.lastResult;
    const intro = options.exam.passed
      ? 'Ya aprobaste este examen. Puedes volver a presentarlo para repasar; tu sello se conserva.'
      : options.experienced && !options.theoryRequired
        ? 'Como tienes experiencia, empiezas por aquí. Si lo apruebas, pasas directo al Simulador de cobranzas. Si no, recorrerás la teoría y luego lo presentarás de nuevo.'
        : 'Ya recorriste la teoría. Demuestra lo que aprendiste: si apruebas, se habilita el Simulador de cobranzas.';
    return `<section class="collections-exam-intro">
      <div class="collections-exam-badge" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8h24l10 10v38H16zM40 8v10h10M23 30l5 5 10-11M23 46h20"/></svg></div>
      <h3 id="exam-title" tabindex="-1">Examen final del módulo</h3>
      <p>${escapar(intro)}</p>
      <ul class="collections-exam-facts"><li><strong>${questions.length}</strong><span>preguntas</span></li><li><strong>${content.minCorrect}</strong><span>correctas para aprobar</span></li><li><strong>1</strong><span>caso ficticio nuevo</span></li></ul>
      <p class="collections-exam-note">Verás la corrección al enviar el examen completo. Lee cada situación con calma.</p>
      ${last && !last.passed ? `<p class="collections-exam-last">Último intento: ${last.correctCount} de ${last.total} correctas.</p>` : ''}
      <div class="collections-actions"><button type="button" data-exam-start class="collections-primary">Comenzar examen →</button></div>
    </section>`;
  }

  function questionHtml(): string {
    const question = questions[index]!;
    const answered = questions.filter((q) => answers[q.key]).length;
    return `<section class="collections-exam-question" aria-labelledby="exam-question-title">
      <div class="collections-exam-top"><span>Pregunta ${index + 1} de ${questions.length}</span><span>${answered} respondidas</span></div>
      <div class="collections-quick-meter" aria-hidden="true">${questions.map((q, position) => `<span class="${position === index ? 'is-current' : answers[q.key] ? 'is-complete' : ''}"></span>`).join('')}</div>
      <p class="collections-quick-caption">${escapar(options.blockTitles[question.block] ?? '')} · Caso ficticio</p>
      <h3 id="exam-question-title" tabindex="-1">${escapar(question.prompt)}</h3>
      <div class="collections-quick-choices" role="radiogroup" aria-labelledby="exam-question-title">${question.options.map((option, position) => `<button type="button" role="radio" data-exam-answer="${escapar(option.id)}" aria-checked="${answers[question.key] === option.id}" class="${answers[question.key] === option.id ? 'is-selected' : ''}"${saving ? ' disabled' : ''}><span aria-hidden="true">${String.fromCharCode(65 + position)}</span>${escapar(option.text)}</button>`).join('')}</div>
      ${error ? `<p id="exam-error" class="collections-submit-error" role="alert" tabindex="-1">${escapar(error)}</p>` : ''}
      <div class="collections-exam-nav">
        <button type="button" data-exam-previous class="collections-secondary"${index === 0 || saving ? ' disabled' : ''}>← Anterior</button>
        ${index < questions.length - 1
          ? `<button type="button" data-exam-next class="collections-primary"${answers[question.key] ? '' : ' disabled'}>Siguiente →</button>`
          : `<button type="button" data-exam-submit class="collections-primary"${answered === questions.length && !saving ? '' : ' disabled'}>${saving ? 'Calificando…' : 'Enviar examen'}</button>`}
      </div>
    </section>`;
  }

  function resultHtml(): string {
    const data = result!;
    const wrong = data.results.filter((item) => !item.correct);
    const text = (key: string, id: string) => questions.find((q) => q.key === key)?.options.find((o) => o.id === id)?.text ?? '';
    const next = data.passed
      ? `<a class="collections-primary" href="${escapar(options.simulatorRoute ?? options.backHref)}">Ir al Simulador de cobranzas →</a>`
      : options.experienced && options.theoryRequired && options.exam.attempts <= 1
        ? '<button type="button" data-exam-theory class="collections-primary">Ir a la teoría →</button>'
        : '<button type="button" data-exam-theory class="collections-secondary">Repasar la teoría</button><button type="button" data-exam-start class="collections-primary">Presentar de nuevo →</button>';
    return `<section class="collections-exam-result ${data.passed ? 'is-correct' : 'is-wrong'}">
      <div class="collections-exam-score" aria-hidden="true">${data.correctCount}<small>/${data.total}</small></div>
      <h3 id="exam-title" tabindex="-1">${data.passed ? '¡Aprobaste el examen!' : 'Aún no apruebas el examen'}</h3>
      ${isLowScore(data.correctCount / data.total * 100) ? lowScoreAlertHtml('el examen final') : ''}
      <p role="status">${data.passed
        ? `Respondiste bien ${data.correctCount} de ${data.total}. Ganaste el sello del módulo y se habilitó el Simulador de cobranzas.`
        : `Respondiste bien ${data.correctCount} de ${data.total}; necesitas ${data.minCorrect}. ${options.experienced && options.theoryRequired && options.exam.attempts <= 1 ? 'Ahora recorrerás la teoría del módulo para reforzar lo necesario y luego podrás presentarlo de nuevo.' : 'Revisa las correcciones, repasa la teoría y vuelve a intentarlo.'}`}</p>
      ${wrong.length ? `<div class="collections-exam-review"><h4>Corrección de tus respuestas incorrectas</h4>${wrong.map((item) => `<article>
        <p class="collections-exam-review-q">${escapar(questions.find((q) => q.key === item.key)?.prompt)}</p>
        <p class="collections-exam-review-bad"><span>Tu respuesta:</span> ${escapar(text(item.key, item.selected))}</p>
        <p class="collections-exam-review-good"><span>Respuesta correcta:</span> ${escapar(text(item.key, item.correctOption))}</p>
        <p class="collections-exam-review-why">${escapar(item.feedback)}</p></article>`).join('')}</div>` : ''}
      <div class="collections-actions">${next}</div>
    </section>`;
  }

  function render(): void {
    root.innerHTML = screen === 'intro' ? introHtml() : screen === 'question' ? questionHtml() : resultHtml();
    root.querySelectorAll('[data-exam-start]').forEach((button) => button.addEventListener('click', () => {
      for (const key of Object.keys(answers)) delete answers[key];
      index = 0; error = ''; screen = 'question'; render(); focus('#exam-question-title');
    }));
    root.querySelector('[data-exam-theory]')?.addEventListener('click', options.goTheory);
    root.querySelectorAll<HTMLButtonElement>('[data-exam-answer]').forEach((button) => button.addEventListener('click', () => {
      answers[questions[index]!.key] = button.dataset.examAnswer!;
      error = ''; render(); focus(`[data-exam-answer="${CSS.escape(button.dataset.examAnswer!)}"]`);
    }));
    root.querySelector('[data-exam-previous]')?.addEventListener('click', () => { index--; render(); focus('#exam-question-title'); });
    root.querySelector('[data-exam-next]')?.addEventListener('click', () => { index++; render(); focus('#exam-question-title'); });
    root.querySelector('[data-exam-submit]')?.addEventListener('click', async () => {
      if (saving) return;
      saving = true; error = ''; render();
      try {
        await options.submit({ ...answers });
      } catch (cause) {
        saving = false; error = (cause as Error).message; render(); focus('#exam-error');
      }
    });
  }
  function focus(selector: string): void { root.querySelector<HTMLElement>(selector)?.focus({ preventScroll: false }); }
  render();
}
