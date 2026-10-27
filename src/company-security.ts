export function createSecurityReading(total: number) {
  let current = 0;
  let unlocked = Math.min(1, total - 1);
  const visited = Array<boolean>(total).fill(false); visited[0] = true;
  return {
    state: () => ({ current, unlocked, visited: [...visited] }),
    select(index: number) {
      if (!Number.isInteger(index) || index < 0 || index > unlocked || index >= total) return false;
      current = index; visited[index] = true; unlocked = Math.max(unlocked, Math.min(index + 1, total - 1));
      return true;
    },
  };
}

// onComplete se avisa una sola vez, al llegar al último paso (los pasos solo se desbloquean en orden).
export function mountSecuritySlider(root: HTMLElement, topic = 'seguridad de la información', onComplete?: () => void): void {
  const slides = root.querySelector<HTMLElement>('[data-security-slides]')!;
  const cards = [...slides.querySelectorAll<HTMLElement>('article')];
  if (!cards.length) return;
  const reading = createSecurityReading(cards.length);
  slides.classList.add('security-slider');
  slides.setAttribute('role', 'region');
  slides.setAttribute('aria-label', `Lectura paso a paso de ${topic}`);
  const options = document.createElement('div'); options.className = 'steps security-options';
  options.setAttribute('role', 'group'); options.setAttribute('aria-label', `Los seis pasos de ${topic}`);
  cards.forEach((card, i) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'step';
    button.dataset.securityStep = String(i); button.setAttribute('aria-controls', `security-slide-${i}`);
    const number = document.createElement('span'); number.textContent = String(i + 1).padStart(2, '0');
    button.append(number, document.createTextNode(card.querySelector('h4')!.textContent!)); options.append(button);
    card.id = `security-slide-${i}`; card.setAttribute('role', 'group'); card.setAttribute('aria-label', `${i + 1} de ${cards.length}`);
    card.querySelector('h4')!.tabIndex = -1;
    const count = card.querySelector<HTMLElement>('.security-number')!;
    count.className = 'detail-count'; count.removeAttribute('aria-hidden'); count.textContent = `PASO ${String(i + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
    const paragraph = card.querySelector('p')!;
    const note = document.createElement('div'); note.className = 'detail-note security-explanation';
    const label = document.createElement('strong'); label.textContent = 'Lo que debes recordar';
    note.append(label, paragraph);
    const avatarSrc = slides.dataset.securityAvatar;
    if (avatarSrc) {
      // Mismo reparto que los principios: personaje a la izquierda, número y título a la derecha, explicación debajo.
      const stage = document.createElement('div'); stage.className = 'principle-stage security-stage';
      const figure = document.createElement('figure'); figure.className = 'security-avatar';
      const image = new Image(); image.src = avatarSrc; image.alt = ''; image.width = 520; image.height = 672; image.decoding = 'async';
      figure.append(image);
      const copy = document.createElement('div'); copy.className = 'principle-copy';
      copy.append(count, card.querySelector('h4')!); stage.append(figure, copy); card.append(stage);
    }
    card.append(note);
  });
  const detail = document.createElement('div'); detail.className = 'step-detail security-detail';
  detail.append(...cards); slides.append(options, detail);
  const steps = [...slides.querySelectorAll<HTMLButtonElement>('[data-security-step]')];
  let completed = false;
  function paint(focus = false) {
    const state = reading.state();
    if (!completed && state.visited[cards.length - 1]) { completed = true; onComplete?.(); }
    cards.forEach((card, i) => { card.hidden = state.current !== i; });
    steps.forEach((button, i) => {
      button.disabled = i > state.unlocked;
      button.toggleAttribute('aria-current', i === state.current);
      if (i === state.current) button.setAttribute('aria-current', 'step');
      const status = i === state.current ? 'Estás aquí' : state.visited[i] ? 'Puedes repasar' : i > state.unlocked ? 'Bloqueado' : 'Siguiente tema';
      button.classList.toggle('is-active', i === state.current);
      button.setAttribute('aria-pressed', String(i === state.current));
      button.title = i > state.unlocked ? 'Recorre el tema anterior para desbloquearlo.' : state.visited[i] ? 'Puedes repasar.' : 'Selecciona este tema al terminar de leer el anterior.';
      button.setAttribute('aria-label', `Paso ${i + 1}: ${cards[i]!.querySelector('h4')!.textContent}. ${status}`);
    });
    if (focus) {
      cards[state.current]!.querySelector<HTMLElement>('h4')!.focus({ preventScroll: true });
      slides.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }
  steps.forEach((button, i) => button.addEventListener('click', () => { if (reading.select(i)) paint(true); }));
  paint();
}
