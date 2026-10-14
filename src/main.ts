import './styles.css';
import { stages } from './content';

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
storyCards.forEach((card, index) => {
  const curtain = card.querySelector<HTMLButtonElement>('.story-curtain')!;
  const content = card.querySelector<HTMLElement>('.story-content')!;
  const advance = card.querySelector<HTMLButtonElement>('.story-next:not(#finish-story)');
  curtain.addEventListener('click', () => {
    if (index > highestUnlockedStory || openedStories.has(index)) return;
    openedStories.add(index);
    content.hidden = false;
    curtain.setAttribute('aria-expanded', 'true');
    curtain.setAttribute('aria-hidden', 'true');
    curtain.inert = true;
    card.classList.add('is-open');
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
  storyCompleted = true;
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
  readingConfirmation.hidden = !lastStage;
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
  showStage(destination);
});
showStage(0);

// Confirmación de lectura y formulario: respuesta solo en la sesión actual.
companyRead.addEventListener('change', () => {
  if (!companyRead.checked) {
    experienceForm.reset();
    experienceResult.hidden = true;
    experienceResult.textContent = '';
  }
  updateExperienceAccess();
});
experienceForm.addEventListener('change', () => { experienceResult.hidden = true; });
experienceForm.addEventListener('submit', (event: SubmitEvent) => {
  event.preventDefault();
  if (currentStage !== stages.length - 1 || !companyRead.checked || !experienceForm.reportValidity()) return;
  const response = new FormData(experienceForm).get('experience');
  if (response !== 'experienced' && response !== 'new') return;
  experienceResult.textContent = response === 'experienced'
    ? 'Has indicado que tienes experiencia en cobranzas digitales. Respuesta confirmada en esta sesión.'
    : 'Has indicado que eres completamente nuevo en cobranzas digitales. Respuesta confirmada en esta sesión.';
  experienceResult.hidden = false;
});

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
