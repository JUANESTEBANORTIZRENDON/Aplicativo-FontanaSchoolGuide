import './styles.css';
import { stages } from './content';
import { api } from './http';
import { showAppLoading } from './loading';

// Obtiene un elemento obligatorio y detecta referencias HTML incorrectas.
function element<T extends HTMLElement>(selector: string): T {
  const result = document.querySelector<T>(selector);
  if (!result) throw new Error(`No se encontró el elemento: ${selector}`);
  return result;
}

// NAVEGACIÓN ENTRE HISTORIA Y MÉTODO
// La ruta permanece visible; su alto determina el espacio al desplazar el contenido.
const learningPath = element('.learning-path');
const pathResizeObserver = new ResizeObserver(() => {
  document.documentElement.style.setProperty('--path-height', `${learningPath.getBoundingClientRect().height}px`);
});
pathResizeObserver.observe(learningPath);
const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
const methodTab = element<HTMLButtonElement>('#method-tab');
let methodUnlocked = false;
function selectTab(index: number): void {
  if (!tabs[index] || tabs[index].disabled || (tabs[index] === methodTab && !methodUnlocked)) return;
  tabs.forEach((tab, position) => {
    const selected = index === position;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    element(`#${tab.getAttribute('aria-controls')}`).hidden = !selected;
  });
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectTab(index));
  tab.addEventListener('keydown', (event: KeyboardEvent) => {
    const availableTabs = tabs.filter((item) => !item.disabled);
    const position = availableTabs.indexOf(tab);
    if (position < 0) return;
    const destinations: Record<string, number> = {
      ArrowRight: (position + 1) % availableTabs.length,
      ArrowLeft: (position + availableTabs.length - 1) % availableTabs.length,
      Home: 0,
      End: availableTabs.length - 1,
    };
    const destination = destinations[event.key];
    if (destination === undefined) return;
    event.preventDefault();
    const destinationTab = availableTabs[destination];
    selectTab(tabs.indexOf(destinationTab));
    destinationTab.focus();
  });
});
// El avance se guarda la primera vez que se termina cada parte; si falla, se reintenta al volver a terminarla.
const savedProgress = { historia: false, metodo: false };
function saveProgress(paso: 'historia' | 'metodo'): void {
  if (savedProgress[paso]) return;
  savedProgress[paso] = true;
  if (paso === 'metodo') savedProgress.historia = true;
  api('/auth/induccion/avance', { method: 'POST', body: JSON.stringify({ paso }) }).catch(() => {
    savedProgress[paso] = false;
  });
}
function focusContent(): void {
  const content = element('#learning');
  content.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  content.focus({ preventScroll: true });
}

// HISTORIA: abre una cortina y pulsa Siguiente para habilitar la próxima.
const storyCards = [...document.querySelectorAll<HTMLElement>('[data-story]')];
const openedStories = new Set<number>();
const completionDialog = element<HTMLDialogElement>('#story-complete-dialog');
const finishStory = element<HTMLButtonElement>('#finish-story');
let storyCompleted = false;
let highestUnlockedStory = 0;
function openStory(index: number): void {
  const card = storyCards[index];
  const curtain = card.querySelector<HTMLButtonElement>('.story-curtain')!;
  openedStories.add(index);
  card.querySelector<HTMLElement>('.story-content')!.hidden = false;
  curtain.disabled = false;
  curtain.setAttribute('aria-expanded', 'true');
  curtain.setAttribute('aria-hidden', 'true');
  curtain.inert = true;
  card.classList.add('is-open');
}
storyCards.forEach((card, index) => {
  const curtain = card.querySelector<HTMLButtonElement>('.story-curtain')!;
  const content = card.querySelector<HTMLElement>('.story-content')!;
  const advance = card.querySelector<HTMLButtonElement>('.story-next:not(#finish-story)');
  curtain.addEventListener('click', () => {
    if (index > highestUnlockedStory || openedStories.has(index)) return;
    openStory(index);
    content.querySelector<HTMLElement>('h4')!.focus({ preventScroll: true });
  });
  advance?.addEventListener('click', () => {
    if (!openedStories.has(index) || index !== highestUnlockedStory) return;
    const nextCard = storyCards[index + 1];
    if (!nextCard) return;
    highestUnlockedStory = index + 1;
    const nextCurtain = nextCard.querySelector<HTMLButtonElement>('.story-curtain')!;
    nextCurtain.disabled = false;
    nextCurtain.querySelector<HTMLElement>('.curtain-status')!.textContent = 'Haz clic para descubrir';
    advance.hidden = true;
    nextCurtain.focus({ preventScroll: true });
    nextCard.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' });
  });
});

// Finalizar permite abrir el aviso de nuevo si el usuario lo cierra.
finishStory.addEventListener('click', () => {
  if (openedStories.size !== storyCards.length) return;
  // Al repasar, el método ya está desbloqueado y se abre directamente.
  if (methodUnlocked) { exploreMethod(); return; }
  storyCompleted = true;
  saveProgress('historia');
  finishStory.textContent = 'Continuar al método →';
  completionDialog.showModal();
});
element('#close-completion').addEventListener('click', () => completionDialog.close());
completionDialog.addEventListener('close', () => {
  if (!methodUnlocked) finishStory.focus({ preventScroll: true });
});

// El botón del aviso abre el recorrido conservando el avance entre etapas.
function exploreMethod(): void {
  if (!storyCompleted) return;
  methodUnlocked = true;
  if (completionDialog.open) completionDialog.close();
  methodTab.disabled = false;
  methodTab.removeAttribute('title');
  selectTab(tabs.indexOf(methodTab));
  focusContent();
}
element('#completion-go-method').addEventListener('click', exploreMethod);

// ETAPAS DEL MÉTODO DE TRABAJO
const stepButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-step]')];
const previous = element<HTMLButtonElement>('#previous');
const next = element<HTMLButtonElement>('#next');
const readingConfirmation = element<HTMLLabelElement>('#reading-confirmation');
const companyRead = element<HTMLInputElement>('#company-read');
const experienceSection = element('#experience-section');
const experienceFields = element<HTMLFieldSetElement>('#experience-fields');
const experienceForm = element<HTMLFormElement>('#experience-form');
const experienceResult = element('#experience-result');
let currentStage = 0;
// Solo «Siguiente etapa» habilita una etapa nueva; las visitadas permiten repaso.
let highestUnlockedStage = 0;
function updateExperienceAccess(): void {
  const lastStage = currentStage === stages.length - 1;
  const unlocked = lastStage && companyRead.checked;
  // La confirmación de lectura se muestra únicamente al terminar las cinco etapas.
  readingConfirmation.hidden = !lastStage;
  // La casilla habilita las opciones de experiencia dentro de la última etapa.
  experienceSection.hidden = !unlocked;
  experienceFields.disabled = !unlocked;
}
function showStage(index: number): void {
  const stage = stages[index];
  if (!stage || index > highestUnlockedStage) return;
  currentStage = index;
  stepButtons.forEach((button, position) => {
    button.classList.toggle('is-active', index === position);
    button.setAttribute('aria-pressed', String(index === position));
    button.disabled = position > highestUnlockedStage;
    button.title = button.disabled ? 'Avanza con «Siguiente etapa» para habilitar este paso.' : '';
  });
  element('#detail-count').textContent = `ETAPA ${String(index + 1).padStart(2, '0')} DE ${String(stages.length).padStart(2, '0')}`;
  element('#detail-title').textContent = stage.title;
  element('#detail-text').textContent = stage.description;
  element('#detail-note').textContent = stage.note;
  previous.disabled = index === 0;
  next.hidden = index === stages.length - 1;
  updateExperienceAccess();
}
stepButtons.forEach((button, index) => button.addEventListener('click', () => showStage(index)));
previous.addEventListener('click', () => showStage(currentStage - 1));
next.addEventListener('click', () => {
  const destination = currentStage + 1;
  if (destination >= stages.length) return;
  highestUnlockedStage = Math.max(highestUnlockedStage, destination);
  if (highestUnlockedStage === stages.length - 1) saveProgress('metodo');
  showStage(destination);
});
showStage(0);

// La experiencia se guarda en el perfil antes de abrir la práctica asignada.
companyRead.addEventListener('change', () => {
  if (!companyRead.checked) {
    experienceForm.reset();
    experienceResult.hidden = true;
    experienceResult.textContent = '';
  }
  updateExperienceAccess();
});
experienceForm.addEventListener('change', () => { experienceResult.hidden = true; });
let savingExperience = false;
experienceForm.addEventListener('submit', async (event: SubmitEvent) => {
  event.preventDefault();
  if (savingExperience || currentStage !== stages.length - 1 || !companyRead.checked || !experienceForm.reportValidity()) return;
  const response = new FormData(experienceForm).get('experience');
  if (response !== 'experienced' && response !== 'new') return;
  savingExperience = true;
  const submit = experienceForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const originalLabel = submit.textContent;
  submit.disabled = true;
  submit.textContent = 'Preparando tu práctica…';
  experienceFields.disabled = true;
  companyRead.disabled = true;
  experienceResult.hidden = true;
  try {
    const result = await fetch('/api/auth/experiencia', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tieneExperienciaCobranzasDigitales: response === 'experienced' }),
    });
    if (result.status === 401) { location.assign('/login'); return; }
    if (result.status === 404) throw new Error('El servidor necesita actualizarse para guardar tu respuesta. Reinicia el servidor de Fontana e intenta nuevamente.');
    if (!result.ok) {
      const body: unknown = await result.json().catch(() => null);
      const message = body && typeof body === 'object' && 'message' in body ? body.message : undefined;
      throw new Error(typeof message === 'string' ? message : 'No pudimos guardar tu respuesta. Intenta nuevamente.');
    }
    showAppLoading('Preparando tu módulo de práctica…');
    location.assign(response === 'experienced' ? '/practica/experiencia' : '/practica/nuevo');
  } catch (error) {
    experienceResult.textContent = error instanceof TypeError
      ? 'No pudimos conectar con el servidor. Revisa tu conexión e intenta nuevamente.'
      : error instanceof Error ? error.message : 'No pudimos guardar tu respuesta. Intenta nuevamente.';
    experienceResult.hidden = false;
    companyRead.disabled = false;
    experienceFields.disabled = false;
    submit.disabled = false;
    submit.textContent = originalLabel;
    savingExperience = false;
  }
});

// Al volver, lo que el asesor ya completó queda desbloqueado: los bloqueos solo aplican la primera vez.
export function restoreProgress(progress: { historia: boolean; metodo: boolean; experiencia: boolean | null }): void {
  const historia = progress.historia || progress.metodo || progress.experiencia !== null;
  const metodo = progress.metodo || progress.experiencia !== null;
  if (historia) {
    savedProgress.historia = true;
    storyCards.forEach((_, index) => openStory(index));
    highestUnlockedStory = storyCards.length - 1;
    document.querySelectorAll<HTMLButtonElement>('.story-next:not(#finish-story)').forEach((button) => { button.hidden = true; });
    storyCompleted = true;
    methodUnlocked = true;
    finishStory.textContent = 'Continuar al método →';
    methodTab.disabled = false;
    methodTab.removeAttribute('title');
  }
  if (metodo) {
    savedProgress.metodo = true;
    highestUnlockedStage = stages.length - 1;
    showStage(currentStage);
  }
  if (progress.experiencia !== null) {
    // Muestra la respuesta guardada; puede cambiarla y volver a confirmar.
    companyRead.checked = true;
    experienceForm.querySelector<HTMLInputElement>(`input[value="${progress.experiencia ? 'experienced' : 'new'}"]`)!.checked = true;
    updateExperienceAccess();
  }
}

// CARRUSEL: cambia CAROUSEL_INTERVAL para ajustar el tiempo, en milisegundos.
const CAROUSEL_INTERVAL = 2000;
const carousel = element('.carousel');
// La foto de Nuestra historia conserva las mismas medidas del carrusel.
const carouselResizeObserver = new ResizeObserver(() => {
  const { width, height } = carousel.getBoundingClientRect();
  document.documentElement.style.setProperty('--carousel-width', `${width}px`);
  document.documentElement.style.setProperty('--carousel-height', `${height}px`);
});
carouselResizeObserver.observe(carousel);
const slides = [...carousel.querySelectorAll<HTMLImageElement>('.slide')];
const dots = [...carousel.querySelectorAll<HTMLButtonElement>('[data-slide]')];
let activeSlide = 0;
let carouselTimer: number | undefined;
function showSlide(index: number): void {
  activeSlide = index;
  slides.forEach((slide, position) => {
    const selected = index === position;
    slide.classList.toggle('is-active', selected);
    slide.setAttribute('aria-hidden', String(!selected));
    dots[position].classList.toggle('is-active', selected);
    dots[position].setAttribute('aria-pressed', String(selected));
  });
}
function startCarousel(): void {
  window.clearInterval(carouselTimer);
  if (document.hidden || carousel.contains(document.activeElement)) return;
  carouselTimer = window.setInterval(() => showSlide((activeSlide + 1) % slides.length), CAROUSEL_INTERVAL);
}
dots.forEach((dot, index) => dot.addEventListener('click', () => { showSlide(index); startCarousel(); }));
carousel.addEventListener('focusin', () => window.clearInterval(carouselTimer));
carousel.addEventListener('focusout', () => window.setTimeout(startCarousel, 0));
document.addEventListener('visibilitychange', startCarousel);
startCarousel();

// Evita temporizadores duplicados cuando Vite actualiza el código al guardar.
if (import.meta.hot) import.meta.hot.dispose(() => {
  window.clearInterval(carouselTimer);
  pathResizeObserver.disconnect();
  carouselResizeObserver.disconnect();
});
