import { escapar } from '../http';
import { isLowScore, lowScoreAlertHtml } from '../low-score';

export type ExamQuestion = { key: string; prompt: string; block: string; options: { id: string; text: string }[] };
export type ExamResult = { passed: boolean; correctCount: number; total: number; minCorrect: number; results: { key: string; block: string; correct: boolean; selected: string; correctOption: string; feedback: string }[] };
export type ExamState = { enabled: boolean; passed: boolean; attempts: number; content: { minCorrect: number; total: number; questions: ExamQuestion[] }; lastResult: ExamResult | null };

// Examen final reutilizable: cada módulo aporta sus textos y el destino al aprobar.
export type ExamOptions = {
  exam: ExamState;
  blockTitles: Record<string, string>;
  // Resultado recién enviado: el contenedor vuelve a montar el examen para mostrarlo.
  result: ExamResult | null;
  submit: (answers: Record<string, string>) => Promise<void>;
  goTheory: () => void;
  intro: string;
  facts: { value: string; label: string }[];
  passedText: (result: ExamResult) => string;
  failedText: (result: ExamResult) => string;
  next: { href: string; label: string };
  // Al reprobar, el único camino es repasar la teoría (quien tiene experiencia la ve después de su primer intento).
  theoryFirst?: boolean;
  lowScoreName: string;
};

// Una pregunta a la vez, sin corrección hasta enviar el examen completo.
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
    return `<section class="collections-exam-intro">
      <div class="collections-exam-badge" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8h24l10 10v38H16zM40 8v10h10M23 30l5 5 10-11M23 46h20"/></svg></div>
      <h3 id="exam-title" tabindex="-1">Examen final del módulo</h3>
      <p>${escapar(options.intro)}</p>
      <ul class="collections-exam-facts">${options.facts.map((fact) => `<li><strong>${escapar(fact.value)}</strong><span>${escapar(fact.label)}</span></li>`).join('')}</ul>
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
      <fieldset class="collections-exam-options"${saving ? ' disabled' : ''}>
        <legend id="exam-question-title" tabindex="-1">${escapar(question.prompt)}</legend>
        ${question.options.map((option, position) => `<label class="collections-exam-option${answers[question.key] === option.id ? ' is-selected' : ''}"><input type="radio" name="exam-answer" value="${escapar(option.id)}"${answers[question.key] === option.id ? ' checked' : ''}><span aria-hidden="true">${String.fromCharCode(65 + position)}</span>${escapar(option.text)}</label>`).join('')}
      </fieldset>
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
      ? `<a class="collections-primary" href="${escapar(options.next.href)}">${escapar(options.next.label)}</a>`
      : options.theoryFirst
        ? '<button type="button" data-exam-theory class="collections-primary">Ir a la teoría →</button>'
        : '<button type="button" data-exam-theory class="collections-secondary">Repasar la teoría</button><button type="button" data-exam-start class="collections-primary">Presentar de nuevo →</button>';
    return `<section class="collections-exam-result ${data.passed ? 'is-correct' : 'is-wrong'}">
      <div class="collections-exam-score" aria-hidden="true">${data.correctCount}<small>/${data.total}</small></div>
      <h3 id="exam-title" tabindex="-1">${data.passed ? '¡Aprobaste el examen!' : 'Aún no apruebas el examen'}</h3>
      ${isLowScore(data.correctCount / data.total * 100) ? lowScoreAlertHtml(options.lowScoreName) : ''}
      <p role="status">${escapar(data.passed ? options.passedText(data) : options.failedText(data))}</p>
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
    root.querySelectorAll<HTMLInputElement>('input[name="exam-answer"]').forEach((input) => input.addEventListener('change', () => {
      answers[questions[index]!.key] = input.value;
      error = ''; render(); focus(`input[name="exam-answer"][value="${CSS.escape(input.value)}"]`);
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
