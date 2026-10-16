import { escapar } from '../http';

const CASES = [
  { concept: 'Producto', prompt: 'Camila pregunta: «¿De dónde sale mi saldo?»', choices: [
    { text: 'Reviso el detalle en la fuente autorizada y se lo explico.', correct: true, feedback: 'Primero verifica qué se cobra; después explícalo con claridad.' },
    { text: 'Le doy un valor aproximado para responder rápido.', correct: false, feedback: 'Una suposición puede confundir. Revisa el detalle antes de responder.' },
  ] },
  { concept: 'Objeciones', prompt: 'Camila dice: «Este mes no puedo pagar».', choices: [
    { text: 'Insisto en el pago sin preguntar qué pasó.', correct: false, feedback: 'Insistir sin escuchar no ayuda a comprender la dificultad.' },
    { text: 'Pregunto qué dificultad tiene en este momento.', correct: true, feedback: 'Escuchar primero te ayuda a comprender su situación.' },
  ] },
  { concept: 'Protocolo', prompt: 'Alguien contesta. Aún no has verificado su identidad.', choices: [
    { text: 'Saludo, me presento y verifico según el guion aprobado.', correct: true, feedback: 'Sigue el protocolo aprobado antes de compartir información de la deuda.' },
    { text: 'Digo el saldo para explicar de inmediato el motivo.', correct: false, feedback: 'Primero verifica la identidad; todavía no compartas datos de la deuda.' },
  ] },
  { concept: 'Marca y cartera', prompt: 'Te asignan una cartera que todavía no conoces.', choices: [
    { text: 'Uso las mismas condiciones de la cartera anterior.', correct: false, feedback: 'Cada cartera puede tener condiciones distintas. Confírmalas internamente.' },
    { text: 'Confirmo la entidad que represento y cómo funciona esa cartera.', correct: true, feedback: 'Conoce la entidad y las condiciones vigentes antes de gestionar.' },
  ] },
  { concept: 'Negociación', prompt: 'Camila pide un descuento que no tienes autorizado.', choices: [
    { text: 'Consulto la solicitud sin prometer que será aprobada.', correct: true, feedback: 'Puedes consultar una alternativa; la consulta no garantiza aprobación.' },
    { text: 'Le aseguro el descuento para lograr un acuerdo.', correct: false, feedback: 'No prometas condiciones que aún no están autorizadas.' },
  ] },
] as const;

export type QuickChallengeState = { index: number; answers: (number | undefined)[]; finished: boolean };

export function mountQuickChallenge(root: HTMLElement, state: QuickChallengeState, options: { onContinue: () => void; saving: boolean; error: string }): void {
  function render(): void {
    const item = CASES[state.index]!;
    const selected = state.answers[state.index];
    const answer = selected === undefined ? undefined : item.choices[selected];
    root.innerHTML = `<section class="collections-quick-challenge" aria-labelledby="quick-challenge-title">
      <header><h3 id="quick-challenge-title" tabindex="-1">Reto rápido</h3><span>${state.finished ? 'Completado' : `${state.index + 1} de ${CASES.length}`}</span></header>
      <div class="collections-quick-meter" role="progressbar" aria-label="Retos resueltos" aria-valuemin="0" aria-valuemax="${CASES.length}" aria-valuenow="${state.finished ? CASES.length : state.index}">${CASES.map((_, position) => `<span class="${state.finished || position < state.index ? 'is-complete' : position === state.index ? 'is-current' : ''}"></span>`).join('')}</div>
      ${state.finished ? `<div class="collections-quick-emblem" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7 16 6 6 12-13"/></svg></div><p class="collections-quick-finish" role="status">¡Resolviste los cinco retos!</p>
      <div class="collections-concepts-continue"><button type="button" data-concept-continue class="collections-primary"${options.saving ? ' disabled' : ''}>${options.saving ? 'Guardando…' : 'Continuar al siguiente bloque →'}</button></div>
      ${options.error ? `<p id="collections-error" class="collections-submit-error" role="alert" tabindex="-1">${escapar(options.error)}</p>` : ''}` : `
      <p class="collections-quick-caption">${escapar(item.concept)} · Caso ficticio · Elige una opción.</p>
      <h4 id="quick-challenge-question" tabindex="-1">${escapar(item.prompt)}</h4>
      <div class="collections-quick-choices" role="group" aria-labelledby="quick-challenge-question">${item.choices.map((choice, position) => `<button type="button" data-quick-answer="${position}" aria-pressed="${selected === position}"${selected === position && !choice.correct ? ' aria-describedby="quick-challenge-feedback"' : ''} class="${selected === position ? choice.correct ? 'is-correct' : 'needs-review' : ''}"><span aria-hidden="true">${String.fromCharCode(65 + position)}</span>${escapar(choice.text)}</button>`).join('')}</div>
      <p id="quick-challenge-feedback" class="collections-quick-feedback${answer ? answer.correct ? ' is-correct' : ' needs-review' : ''}" role="status">${answer ? `${answer.correct ? '✓ Bien. ' : '↻ Revisa. '}${escapar(answer.feedback)}` : ''}</p>
      <footer><span>${answer && !answer.correct ? 'Vuelve a intentarlo. Elige otra opción.' : 'Si aciertas, avanzas automáticamente.'}</span></footer>`}
    </section>`;
    root.querySelector('[data-concept-continue]')?.addEventListener('click', options.onContinue);
    root.querySelectorAll<HTMLButtonElement>('[data-quick-answer]').forEach((button) => button.addEventListener('click', () => {
      const selected = Number(button.dataset.quickAnswer);
      state.answers[state.index] = selected;
      const correct = item.choices[selected]!.correct;
      if (correct) {
        if (state.index === CASES.length - 1) state.finished = true;
        else state.index++;
      }
      render();
      root.querySelector<HTMLElement>(correct ? state.finished ? '#quick-challenge-title' : '#quick-challenge-question' : `[data-quick-answer="${selected}"]`)?.focus({ preventScroll: true });
    }));
  }
  render();
}
