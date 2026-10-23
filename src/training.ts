import './styles.css';
import './company-security.css';
import { mountSecuritySlider } from './company-security';
import { api } from './http';
import { showAppLoading } from './loading';
import type { PrinciplesPanel } from './tutor/principles-panel';

// Obtiene un elemento obligatorio y detecta referencias HTML incorrectas.
function element<T extends HTMLElement>(selector: string): T {
  const result = document.querySelector<T>(selector);
  if (!result) throw new Error(`No se encontró el elemento: ${selector}`);
  return result;
}

mountSecuritySlider(element('#security'));

// NAVEGACIÓN ENTRE HISTORIA, PRINCIPIOS Y SEGURIDAD
// La ruta permanece visible; su alto determina el espacio al desplazar el contenido.
const learningPath = element('.learning-path');
const pathResizeObserver = new ResizeObserver(() => {
  document.documentElement.style.setProperty('--path-height', `${learningPath.getBoundingClientRect().height}px`);
});
pathResizeObserver.observe(learningPath);
const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
const principlesTab = element<HTMLButtonElement>('#principles-tab');
let principlesUnlocked = false;
// PRINCIPIOS DE TRABAJO: el tutor (con voz) se carga solo al abrir la pestaña y se silencia al salir de ella.
let principles: PrinciplesPanel | null = null;
let principlesVisible = false;
async function showPrinciples(): Promise<void> {
  if (!principles) {
    const { mountPrinciples } = await import('./tutor/principles-panel');
    principles ??= mountPrinciples(element('#principles-mount'), { completed: principlesReviewed, onProgress: updatePrinciplesProgress });
  }
  if (principlesVisible) principles.show(); else principles.hide();
  if (principlesReviewed && !inductionCompleted) saveProgress('metodo');
}
// Los principios se habilitan al terminar Nuestra historia.
function unlockTab(tab: HTMLButtonElement): void {
  tab.disabled = false;
  tab.removeAttribute('title');
}
function selectTab(index: number): void {
  if (!tabs[index] || tabs[index].disabled) return;
  tabs.forEach((tab, position) => {
    const selected = index === position;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    element(`#${tab.getAttribute('aria-controls')}`).hidden = !selected;
  });
  principlesVisible = tabs[index] === principlesTab;
  if (principlesVisible || principles) void showPrinciples();

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
  // Al repasar, los principios ya están desbloqueados y se abren directamente.
  if (principlesUnlocked) { explorePrinciples(); return; }
  storyCompleted = true;
  saveProgress('historia');
  finishStory.textContent = 'Continuar a los principios →';
  completionDialog.showModal();
});
element('#close-completion').addEventListener('click', () => completionDialog.close());
completionDialog.addEventListener('close', () => {
  if (!principlesUnlocked) finishStory.focus({ preventScroll: true });
});

// El botón del aviso abre el recorrido conservando el avance entre etapas.
function explorePrinciples(): void {
  if (!storyCompleted) return;
  principlesUnlocked = true;
  if (completionDialog.open) completionDialog.close();
  unlockTab(principlesTab);
  selectTab(tabs.indexOf(principlesTab));
  focusContent();
}
element('#completion-go-principles').addEventListener('click', explorePrinciples);

// CONFIRMACIÓN DE LECTURA Y ACCESO AL AULA
const readingConfirmation = element<HTMLLabelElement>('#reading-confirmation');
const companyRead = element<HTMLInputElement>('#company-read');
const experienceSection = element('#experience-section');
const experienceFields = element<HTMLFieldSetElement>('#experience-fields');
const experienceForm = element<HTMLFormElement>('#experience-form');
const experienceResult = element('#experience-result');
const principlesProgress = element('#principles-progress');
let principlesReviewed = false;
// Con la inducción ya terminada (repaso) los principios no vuelven a bloquear el acceso.
let inductionCompleted = false;
function updateExperienceAccess(): void {
  const unlocked = principlesReviewed && companyRead.checked;
  // La confirmación de lectura se muestra únicamente al revisar los cinco principios.
  readingConfirmation.hidden = !principlesReviewed;
  // La casilla habilita el acceso al aula.
  experienceSection.hidden = !unlocked;
  experienceFields.disabled = !unlocked;
}
function updatePrinciplesProgress({ reviewed, total }: { reviewed: number; total: number }): void {
  if (inductionCompleted) return;
  if (principlesReviewed && reviewed >= total) { updateExperienceAccess(); return; }
  principlesReviewed = reviewed >= total;
  if (principlesReviewed) saveProgress('metodo');
  principlesProgress.textContent = principlesReviewed
    ? 'Revisaste los cinco principios. Confirma tu lectura para continuar al aula.'
    : `Revisa los cinco principios para continuar. Llevas ${reviewed} de ${total}.`;
  updateExperienceAccess();
}
// Al terminar la inducción inicial se abre la ruta de formación; la experiencia se pregunta en el módulo 02.
companyRead.addEventListener('change', () => {
  if (!companyRead.checked) {
    experienceResult.hidden = true;
    experienceResult.textContent = '';
  }
  updateExperienceAccess();
});
let finishing = false;
experienceForm.addEventListener('submit', async (event: SubmitEvent) => {
  event.preventDefault();
  if (finishing || !principlesReviewed || !companyRead.checked) return;
  finishing = true;
  const submit = experienceForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const originalLabel = submit.textContent;
  submit.disabled = true;
  submit.textContent = 'Preparando tu ruta…';
  companyRead.disabled = true;
  experienceResult.hidden = true;
  try {
    const result = await fetch('/api/auth/induccion/completar', { method: 'POST', credentials: 'same-origin' });
    if (result.status === 401) { location.assign('/login'); return; }
    if (result.status === 404) throw new Error('El servidor necesita actualizarse. Reinicia el servidor de Fontana e intenta nuevamente.');
    if (!result.ok) {
      const body: unknown = await result.json().catch(() => null);
      const message = body && typeof body === 'object' && 'message' in body ? body.message : undefined;
      throw new Error(typeof message === 'string' ? message : 'No pudimos continuar. Intenta nuevamente.');
    }
    showAppLoading('Preparando tu ruta de formación…');
    location.assign('/practica');
  } catch (error) {
    experienceResult.textContent = error instanceof TypeError
      ? 'No pudimos conectar con el servidor. Revisa tu conexión e intenta nuevamente.'
      : error instanceof Error ? error.message : 'No pudimos continuar. Intenta nuevamente.';
    experienceResult.hidden = false;
    companyRead.disabled = false;
    submit.disabled = false;
    submit.textContent = originalLabel;
    finishing = false;
  }
});

// Al volver, lo que el asesor ya completó queda desbloqueado: los bloqueos solo aplican la primera vez.
export function restoreProgress(progress: { historia: boolean; metodo: boolean; completada: boolean }): void {
  const historia = progress.historia || progress.metodo || progress.completada;
  if (historia) {
    savedProgress.historia = true;
    storyCards.forEach((_, index) => openStory(index));
    highestUnlockedStory = storyCards.length - 1;
    document.querySelectorAll<HTMLButtonElement>('.story-next:not(#finish-story)').forEach((button) => { button.hidden = true; });
    storyCompleted = true;
    principlesUnlocked = true;
    finishStory.textContent = 'Continuar a los principios →';
    unlockTab(principlesTab);
  }
  if (progress.metodo || progress.completada) {
    savedProgress.metodo = true;
    principlesReviewed = true;
    principlesProgress.textContent = 'Ya completaste los principios de trabajo.';
    // Solo la inducción terminada restaura también la confirmación final.
    inductionCompleted = progress.completada;
    companyRead.checked = progress.completada;
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
  principles?.destroy();
  pathResizeObserver.disconnect();
  carouselResizeObserver.disconnect();
});
