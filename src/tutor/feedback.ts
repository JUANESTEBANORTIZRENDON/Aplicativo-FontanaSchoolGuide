import { createTutor } from './tutor';
import type { TutorExpression } from './manifest';

// Acompaña una devolución ya calculada: no elige respuestas, notas ni desbloqueos.
export function decorateTutorFeedback(feedback: HTMLElement, expression: TutorExpression): () => void {
  const wrapper = document.createElement('div');
  wrapper.className = 'tutor-feedback';
  if (!feedback.textContent?.trim()) wrapper.classList.add('tutor-feedback--avatar-only');
  wrapper.dataset.tone = expression;
  const portrait = document.createElement('div');
  portrait.className = 'tutor-feedback-avatar';
  feedback.before(wrapper); wrapper.append(portrait, feedback);
  const tutor = createTutor(portrait, { ambient: false });
  const activity = wrapper.closest('[data-excel-simulator], .collections-quick-challenge, .collections-dossier') ?? wrapper.parentElement!;
  const typing = () => tutor.pauseAmbient(Boolean(activity.querySelector('input:focus, textarea:focus, select:focus, [contenteditable="true"]:focus')));
  activity.addEventListener('focusin', typing); activity.addEventListener('focusout', typing);
  let disposed = false;
  // Se comprueba como máximo una vez por fotograma, sin importar cuántas mutaciones haga la página.
  let checking = false;
  const observer = new MutationObserver(() => {
    if (checking) return;
    checking = true;
    requestAnimationFrame(() => { checking = false; if (!wrapper.isConnected) destroy(); });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  function destroy() {
    if (disposed) return;
    disposed = true; observer.disconnect();
    activity.removeEventListener('focusin', typing); activity.removeEventListener('focusout', typing);
    tutor.destroy();
  }
  tutor.react(expression);
  return destroy;
}
