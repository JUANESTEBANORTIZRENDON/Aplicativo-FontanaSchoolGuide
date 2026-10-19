import '../styles.css';
import '../practice.css';
import './office.css';
import { playSeal } from '../seal-animation';
import { mountHeaderAccount } from '../header-account';
import { escapar } from '../http';
import { ApiError, officeApi, SECTION_KEYS, type Lesson, type ModuleState, type SectionKey } from './api';

// Módulo "Ofimática para tus cobranzas": bienvenida, mecanografía, Excel, ortografía y resultado.
// El servidor decide accesos, intentos, notas y sello; aquí solo se muestra y se recogen respuestas.

export type OfficeContext = {
  view: HTMLElement;
  state: ModuleState;
  go: (section: SectionKey) => void;
  // Vuelve a pedir el estado al servidor, actualiza el recorrido y redibuja la sección actual.
  reload: () => Promise<void>;
  // Solo refresca el estado y el recorrido (sin redibujar la sección).
  refresh: () => Promise<ModuleState>;
  backHref: string;
};

const BASE_PATH = '/induccion/modulos/ofimatica-mecanografia';
const TITLES: Record<SectionKey, string> = {
  bienvenida: 'Bienvenida', mecanografia: 'Mecanografía', excel: 'Excel para cobranzas', ortografia: 'Ortografía aplicada', resultado: 'Resultado y sello',
};

export function sectionFromPath(pathname: string): SectionKey | null {
  const match = new RegExp(`^${BASE_PATH}/(${SECTION_KEYS.join('|')})/?$`).exec(pathname);
  return (match?.[1] as SectionKey | undefined) ?? null;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'No pudimos completar la acción. Intenta nuevamente.';
}

// Tarjeta de carga con indicador circular: se muestra mientras el servidor responde.
export function loadingCard(message: string, detail = ''): string {
  return `<section class="office-card office-loading-card" role="status" aria-live="polite">
    <span class="office-spinner" aria-hidden="true"></span>
    <p class="office-loading-title">${escapar(message)}</p>
    ${detail ? `<p class="office-loading-detail">${escapar(detail)}</p>` : ''}
  </section>`;
}

// Capa de carga sobre una tarjeta que debe seguir visible (por ejemplo, el texto de la prueba al iniciarla).
// Devuelve la función que la quita.
export function loadingOverlay(card: HTMLElement, message: string): () => void {
  const layer = document.createElement('div');
  layer.className = 'office-loading-overlay';
  layer.setAttribute('role', 'status');
  layer.innerHTML = `<span class="office-spinner" aria-hidden="true"></span><p class="office-loading-title">${escapar(message)}</p>`;
  card.append(layer);
  return () => layer.remove();
}

// Pantalla de carga fija sobre toda la página: se usa al calificar (el formulario puede ser largo y la
// tarjeta quedaría fuera de la vista). Devuelve la función que la quita.
export function loadingScreen(message: string, detail = ''): () => void {
  const layer = document.createElement('div');
  layer.className = 'office-loading-screen';
  layer.innerHTML = loadingCard(message, detail);
  document.body.append(layer);
  return () => layer.remove();
}

// Las ilustraciones de lecciones y preguntas se amplían a pantalla completa con un clic.
function bindImageZoom(container: HTMLElement): void {
  const dialog = document.createElement('dialog');
  dialog.className = 'office-zoom';
  dialog.innerHTML = '<button type="button" class="office-zoom-close" aria-label="Cerrar imagen ampliada">✕</button><img alt="">';
  document.body.append(dialog);
  const image = dialog.querySelector('img')!;
  container.addEventListener('click', (event) => {
    const source = (event.target as HTMLElement).closest<HTMLImageElement>('img.office-zoomable');
    if (!source) return;
    image.src = source.currentSrc || source.src;
    image.alt = source.alt;
    dialog.showModal();
  });
  dialog.addEventListener('click', () => dialog.close());
}

export function showError(container: HTMLElement, error: unknown): void {
  let box = container.querySelector<HTMLElement>('.office-error');
  if (!box) {
    box = document.createElement('p');
    box.className = 'office-error';
    box.setAttribute('role', 'alert');
    container.prepend(box);
  }
  box.textContent = errorMessage(error);
}

export async function mountOffice(nombre: string, initial: SectionKey | null, backHref: string): Promise<void> {
  document.body.className = 'practice-screen office-screen';
  const root = document.querySelector<HTMLElement>('#app-content')!;
  root.innerHTML = `
    <header><a class="brand" href="${escapar(backHref)}" aria-label="Fontana, volver a tu ruta de formación"><span class="brand-image"><img src="/imagenes/fontana-logo.png" alt=""><strong class="brand-name">FONTANA</strong></span></a><span class="header-divider"></span><span class="platform">AULA DE FORMACIÓN</span></header>
    <main class="office-main">
      <div class="office-progress-bar"><a class="office-progress-link" href="${escapar(backHref)}">Ver mi progreso del aula <span aria-hidden="true">→</span></a></div>
      <nav class="office-steps" aria-label="Secciones del módulo"></nav>
      <section id="office-view" class="office-view" tabindex="-1" aria-live="polite">${loadingCard('Cargando tu módulo…')}</section>
      <footer><span>Fontana · Aula de formación</span><span>Módulo 01</span></footer>
    </main>`;
  document.body.hidden = false;
  const stepsNav = root.querySelector<HTMLElement>('.office-steps')!;
  const view = root.querySelector<HTMLElement>('#office-view')!;
  mountHeaderAccount(nombre, 'Ofimática para tus cobranzas');
  bindImageZoom(root);

  let state: ModuleState;
  try {
    state = await officeApi.module();
  } catch (error) {
    const reason = error instanceof ApiError && typeof error.details?.blockedReason === 'string' ? error.details.blockedReason : errorMessage(error);
    view.innerHTML = `<section class="office-card"><p class="eyebrow">ACCESO NO DISPONIBLE</p><h1>Todavía no puedes entrar a este módulo</h1><p class="office-error" role="alert">${escapar(reason)}</p><a class="primary" href="${escapar(backHref)}">Volver a tu ruta de formación</a></section>`;
    return;
  }

  let current: SectionKey = initial ?? state.currentSection;

  function renderSteps(): void {
    stepsNav.innerHTML = `<ol>${state.sections.map((section, index) => {
      const done = section.status === 'COMPLETED';
      const label = done ? (section.alert ? 'Completado · con alertas' : 'Completado') : section.status === 'NO_ATTEMPTS' ? 'Sin intentos' : section.key === current ? 'Estás aquí' : 'Pendiente';
      return `<li data-status="${section.status}"${section.key === current ? ' aria-current="step"' : ''}>
        <button type="button" data-section="${section.key}"><span class="office-step-number">${done ? '✓' : String(index + 1).padStart(2, '0')}</span><span>${escapar(TITLES[section.key])}<small>${label}</small></span></button>
      </li>`;
    }).join('')}</ol>`;
  }

  const ctx: OfficeContext = {
    view,
    get state() { return state; },
    backHref,
    go: (section) => show(section, true),
    refresh: async () => { state = await officeApi.module(); renderSteps(); return state; },
    reload: async () => { await ctx.refresh(); await render(); },
  };

  async function render(): Promise<void> {
    renderSteps();
    view.innerHTML = loadingCard(`Cargando ${TITLES[current]}…`);
    try {
      if (current === 'bienvenida') await renderWelcome(ctx);
      else if (current === 'mecanografia') (await import('./typing')).renderTyping(ctx);
      else if (current === 'excel') await (await import('./excel')).renderExcel(ctx);
      else if (current === 'ortografia') await (await import('./dictation')).renderDictation(ctx);
      else await renderResult(ctx);
    } catch (error) {
      showError(view, error);
    }
  }

  function show(section: SectionKey, push: boolean): void {
    current = section;
    if (push) history.pushState({ section }, '', `${BASE_PATH}/${section}`);
    void render().then(() => view.focus({ preventScroll: true }));
  }

  stepsNav.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-section]');
    if (button) show(button.dataset.section as SectionKey, true);
  });
  window.addEventListener('popstate', () => show(sectionFromPath(location.pathname) ?? state.currentSection, false));
  history.replaceState({ section: current }, '', `${BASE_PATH}/${current}`);
  await render();
}

// ---------------------------------------------------------------------------------------------
// Bienvenida
// ---------------------------------------------------------------------------------------------

type WelcomeContent = { welcome: { title: string; intro: string; expectedMinutes: { min: number; max: number }; steps: { key: string; title: string; text: string }[]; note: string } };

async function renderWelcome(ctx: OfficeContext): Promise<void> {
  const [{ welcome }] = await Promise.all([officeApi.content<WelcomeContent>('bienvenida'), officeApi.view('bienvenida').catch(() => undefined)]);
  const config = ctx.state.config;
  ctx.view.innerHTML = `
    <section class="office-card" aria-labelledby="welcome-title">
      <p class="eyebrow">MÓDULO 01 · BIENVENIDA</p>
      <h1 id="welcome-title">${escapar(welcome.title)}</h1>
      <p class="office-lead">${escapar(welcome.intro)}</p>
      <p class="office-duration">Duración estimada: ${welcome.expectedMinutes.min} a ${welcome.expectedMinutes.max} minutos.</p>
      <ol class="office-plan">
        ${welcome.steps.map((step, index) => `<li><span class="office-step-number">${String(index + 1).padStart(2, '0')}</span><div><strong>${escapar(step.title)}</strong><p>${escapar(step.text)}</p></div></li>`).join('')}
      </ol>
      <ul class="office-goals">
        <li><strong>Mecanografía:</strong> ${config.typing.minCorrectCpm} caracteres correctos por minuto con ${config.typing.minAccuracy} % de precisión, en ${config.typing.durationSeconds} segundos.</li>
        <li><strong>Excel:</strong> ${config.excel.minScore} puntos de 100.</li>
        <li><strong>Ortografía:</strong> ${config.dictation.minScore} puntos y ningún error crítico.</li>
      </ul>
      <p class="office-note">${escapar(welcome.note)}</p>
      <div class="office-actions"><button class="primary" id="welcome-start" type="button">Comenzar con la mecanografía →</button></div>
    </section>`;
  ctx.view.querySelector<HTMLButtonElement>('#welcome-start')!.addEventListener('click', async () => {
    await ctx.refresh().catch(() => undefined);
    ctx.go('mecanografia');
  });
}

// ---------------------------------------------------------------------------------------------
// Resultado y sello
// ---------------------------------------------------------------------------------------------

// Ilustraciones de las lecciones (src/office/imagenes): una por lección, nombrada excel-<clave> u orto-<clave>.
// Una imagen subida por el administrador al almacenamiento tiene prioridad sobre la ilustración incluida.
const LESSON_IMAGES = import.meta.glob('./imagenes/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
// Ilustración incluida por nombre de archivo (sin extensión), por ejemplo «excel-q-suma».
export const bundledAsset = (name: string): string | null => LESSON_IMAGES[`./imagenes/${name}.svg`] ?? null;
const bundledImage = (key: string): string | null => LESSON_IMAGES[`./imagenes/excel-${key}.svg`] ?? LESSON_IMAGES[`./imagenes/orto-${key}.svg`] ?? null;

export function lessonCard(lesson: Lesson): string {
  const image = lesson.image;
  const src = image?.url ?? bundledImage(lesson.key);
  const picture = image
    ? (src
      ? `<img class="office-zoomable" title="Haz clic para ampliar" src="${escapar(src)}" alt="${escapar(image.url ? image.alt : `Ilustración de la lección «${lesson.title}»`)}" width="${image.width}" height="${image.height}" loading="lazy" decoding="async">`
      : `<div class="office-image-placeholder" role="img" aria-label="${escapar(image.alt)}" style="aspect-ratio:${image.width}/${image.height}"><span>Imagen en preparación</span><small>${escapar(image.alt)}</small></div>`)
    : '';
  return `
    <article class="office-lesson">
      ${picture ? `<figure>${picture}<figcaption>${escapar(image!.caption)}${src ? ' <span class="office-zoom-hint">· Haz clic en la imagen para ampliarla</span>' : ''}</figcaption></figure>` : ''}
      <div>
        <h3>${escapar(lesson.title)}</h3>
        <p>${escapar(lesson.summary)}</p>
        <p class="office-rule"><strong>Regla:</strong> ${escapar(lesson.rule)}</p>
        <div class="office-compare">
          <p class="office-wrong"><span>Incorrecto</span>${escapar(lesson.incorrect)}</p>
          <p class="office-right"><span>Correcto</span>${escapar(lesson.correct)}</p>
        </div>
      </div>
    </article>`;
}

async function renderResult(ctx: OfficeContext): Promise<void> {
  const result = await officeApi.result();
  const state = await ctx.refresh();
  const sectionLine = result.sections.map((section) => `<li data-status="${section.status}"${section.alert ? ' data-alert="true"' : ''}><span>${escapar(section.title)}</span><strong>${section.status === 'COMPLETED' ? (section.alert ? 'Presentado · con alertas' : 'Aprobado') : section.status === 'NO_ATTEMPTS' ? 'Sin intentos' : 'Pendiente'}</strong></li>`).join('');
  const PART_TITLE: Record<string, string> = { mecanografia: 'Mecanografía', excel: 'Excel', ortografia: 'Ortografía' };
  const score = result.moduleScore;
  const scoreBlock = score ? `<div class="office-module-score"><div><strong>${score.score.toFixed(1)}</strong><span>nota del módulo (de 100)</span></div><ul>${score.parts.map((part) => `<li>${escapar(PART_TITLE[part.key] ?? part.key)}: ${part.score.toFixed(0)} puntos <small>(pesa ${part.weight} %)</small></li>`).join('')}</ul></div>` : '';
  const next = result.nextStep.module;
  ctx.view.innerHTML = `
    <section class="office-card" aria-labelledby="result-title">
      <p class="eyebrow">MÓDULO 01 · RESULTADO</p>
      <h1 id="result-title">${result.sealIssued ? 'Sello de Ofimática para tus cobranzas' : 'Tu avance en el módulo'}</h1>
      ${result.sealIssued
        ? `<div class="office-seal" role="img" aria-label="Sello del módulo obtenido"><span>✓</span><div><strong>¡Módulo aprobado!</strong><small>Obtuviste el sello el ${escapar(new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'America/Bogota' }).format(new Date(result.sealIssuedAt ?? Date.now())))}.</small></div></div>`
        : `<p class="office-lead">Aprueba mecanografía, Excel y ortografía para obtener el sello. Progreso del módulo: ${escapar(result.progressPercent)} %.</p>`}
      <ul class="office-summary">${sectionLine}</ul>
      ${scoreBlock}
      <div class="office-columns">
        <div><h2>Lo que haces bien</h2>${result.strengths.length ? `<ul>${result.strengths.map((item) => `<li>${escapar(item)}</li>`).join('')}</ul>` : '<p>Aún no hay resultados para destacar.</p>'}</div>
        <div><h2>Lo que debes reforzar</h2>${result.reinforce.length ? `<ul>${result.reinforce.map((item) => `<li>${escapar(item)}</li>`).join('')}</ul>` : '<p>No tienes refuerzos pendientes. ¡Muy bien!</p>'}</div>
      </div>
      <p class="office-note">${escapar(result.nextStep.text)}</p>
      <div class="office-actions">
        ${result.sealIssued && next
          ? (next.enabled ? `<a class="primary" id="result-next" href="${escapar(next.route)}">Ir a ${escapar(next.name)} →</a>` : `<p class="office-error">${escapar(next.blockedReason ?? 'Módulo no disponible.')}</p>`)
          : `<button class="primary" id="result-continue" type="button">Continuar con ${escapar(TITLES[state.currentSection])} →</button>`}
        <a class="office-secondary" href="${escapar(ctx.backHref)}">Volver a tu ruta de formación</a>
      </div>
    </section>`;
  ctx.view.querySelector<HTMLButtonElement>('#result-continue')?.addEventListener('click', () => ctx.go(state.currentSection));
  // El sello se celebra una sola vez por navegador (la clave incluye la fecha en que se emitió).
  if (result.sealIssued && result.sealIssuedAt) {
    const key = `fontana:sello:ofimatica-mecanografia:${result.sealIssuedAt}`;
    let celebrated = true;
    try { celebrated = localStorage.getItem(key) === '1'; if (!celebrated) localStorage.setItem(key, '1'); } catch { celebrated = false; }
    if (!celebrated) void playSeal({ moduleName: 'Ofimática para tus cobranzas', moduleNumber: 1, label: 'APROBADO', nextName: next?.name ?? null });
  }
}
