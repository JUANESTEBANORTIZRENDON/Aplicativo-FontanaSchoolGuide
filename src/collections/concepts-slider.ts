import { escapar } from '../http';

const icon = (paths: string) => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const SLIDES = [
  { title: 'Conocimiento del producto', definition: 'Entiende qué se cobra y de dónde viene el saldo.', example: 'Camila pregunta por $480.000: revisas el detalle antes de explicarlo.', reminder: 'Consulta la ficha del producto aprobada.',
    icon: icon('<path d="M10 13h18l4 4 4-4h18v38H36l-4 4-4-4H10zM32 17v38M17 24h8M17 32h8M39 24h8M39 32h8"/>') },
  { title: 'Manejo de objeciones', definition: 'Escucha la dificultad y pregunta antes de responder.', example: '«No puedo pagar». → «¿Qué dificultad tienes en este momento?»', reminder: 'Comprende sin discutir ni juzgar.',
    icon: icon('<path d="M10 12h34v25H26L14 47V37h-4zM44 24h10v25h-8l-8 7v-7H27M18 22h18M18 29h11"/>') },
  { title: 'Protocolo de la llamada', definition: 'Saluda, preséntate y verifica la identidad según el guion aprobado.', example: '«Buenos días, soy Laura». Continúas con la presentación autorizada.', reminder: 'Verifica la identidad antes de hablar de la deuda.',
    icon: icon('<path d="m18 10 9 11-6 7c4 7 8 11 15 15l7-6 11 9-6 9C29 55 9 35 9 16zM39 11c8 1 13 6 14 14M38 19c4 0 7 3 7 7"/>') },
  { title: 'Conocimiento de la marca', definition: 'Conoce a quién representas y cómo se gestiona cada cartera.', example: 'En el caso de Camila, revisas la entidad y las opciones vigentes de su cartera.', reminder: 'Valida el funcionamiento de la cartera con tu coordinador.',
    icon: icon('<path d="M10 25 32 10l22 15zM13 52h38M18 29v17M32 29v17M46 29v17M10 47h44v5H10z"/>') },
  { title: 'Habilidad de negociar', definition: 'Busca una opción autorizada que se ajuste a la posibilidad del cliente.', example: 'Camila propone $200.000 el día 20: revisas si esa opción está permitida.', reminder: 'Si sale de tu autorización, consulta antes de prometer.',
    icon: icon('<path d="m8 25 10-9 11 5 7-5 20 12-8 19-12-1-12-8-7 4zM29 21l-8 10 6 5 10-9 13 10M24 38l12 10M8 25l9 17M56 28l-8 19"/>') },
] as const;

export function mountConceptsSlider(root: HTMLElement, options: { initialSlide: number; onSlide: (index: number) => void; mountChallenge: (root: HTMLElement) => void }): void {
  let index = Math.max(0, Math.min(SLIDES.length, options.initialSlide));
  let motion = '';

  function go(next: number, focusTarget: 'title' | 'next' | 'previous' = 'title'): void {
    const target = Math.max(0, Math.min(SLIDES.length, next));
    if (target === index) return;
    motion = next > index ? 'next' : 'previous';
    index = target;
    render();
    const selector = focusTarget === 'title' ? '#concepts-slide-title' : focusTarget === 'next' ? '[data-concept-next]' : '[data-concept-previous]';
    const focus = index === SLIDES.length ? root.querySelector<HTMLElement>('#quick-challenge-question, #quick-challenge-title') : root.querySelector<HTMLElement>(selector);
    (focus?.matches(':disabled') ? root.querySelector<HTMLElement>('#concepts-slide-title') : focus)?.focus({ preventScroll: true });
    options.onSlide(index);
  }
  function card(): string {
    const slide = SLIDES[index]!;
    return `<article class="fontana-concept-card fontana-concept-card--active" role="group" aria-roledescription="diapositiva" aria-label="${index + 1} de 5">
      <div class="fontana-concept-brand"><img src="/imagenes/fontana-logo.png" alt="" draggable="false" width="38" height="38"><span>FONTANA<small>SCHOOL</small></span><span class="fontana-concept-number">0${index + 1}</span></div>
      ${index === 0 ? '<p class="fontana-concept-notice" role="note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 10 18H2zM12 9v5M12 17h.01"/></svg><span><strong>Lee con atención:</strong> al terminar las cinco tarjetas tendrás un reto rápido.</span></p>' : ''}
      <div class="fontana-concept-icon">${slide.icon}</div>
      <h3 id="concepts-slide-title" tabindex="-1">${escapar(slide.title)}</h3>
      <p class="fontana-concept-definition">${escapar(slide.definition)}</p>
      <div class="fontana-concept-example"><span>EJEMPLO FICTICIO</span><p>${escapar(slide.example)}</p></div>
      <p class="fontana-concept-reminder">${escapar(slide.reminder)}</p>
    </article>`;
  }
  function render(): void {
    const challengeScreen = index === SLIDES.length;
    root.innerHTML = `<section class="fontana-concepts" role="region" aria-roledescription="carrusel" aria-label="Cinco conceptos básicos de cobranza y reto rápido">
      <div class="fontana-concept-stage" data-motion="${motion}">
        ${challengeScreen ? '<div class="fontana-concept-card fontana-concept-card--active fontana-concept-card--quiz" data-inline-challenge role="group" aria-roledescription="diapositiva" aria-label="Reto rápido después de los cinco conceptos"></div>' : card()}
        <button type="button" data-concept-previous class="fontana-concept-arrow fontana-concept-arrow--left" aria-label="Concepto anterior"${index === 0 ? ' disabled' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button>
        <button type="button" data-concept-next class="fontana-concept-arrow fontana-concept-arrow--right" aria-label="${index === SLIDES.length - 1 ? 'Ir al reto rápido' : 'Concepto siguiente'}"${challengeScreen ? ' disabled' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>
      </div>
      <div class="fontana-concept-footer"><div class="fontana-concept-dots" aria-hidden="true">${SLIDES.map((_, position) => `<span${position === index ? ' class="is-current"' : ''}></span>`).join('')}</div><span class="fontana-concept-counter" aria-live="polite">${challengeScreen ? 'Reto rápido' : `${index + 1} / 5`}</span></div>
      <p class="fontana-concept-instruction">${challengeScreen ? 'Elige una respuesta y practica a tu ritmo.' : index === SLIDES.length - 1 ? 'Pulsa la flecha derecha para ir al reto rápido.' : 'Usa las flechas para cambiar de tarjeta.'}</p>
    </section>`;
    root.querySelector('[data-concept-previous]')!.addEventListener('click', () => go(index - 1, 'previous'));
    root.querySelector('[data-concept-next]')!.addEventListener('click', () => go(index + 1, 'next'));
    const challenge = root.querySelector<HTMLElement>('[data-inline-challenge]');
    if (challenge) options.mountChallenge(challenge);
  }
  root.addEventListener('keydown', (event) => {
    if ((event.target as HTMLElement).closest('[data-inline-challenge]')) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); go(index + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(index - 1); }
  });
  render();
}
