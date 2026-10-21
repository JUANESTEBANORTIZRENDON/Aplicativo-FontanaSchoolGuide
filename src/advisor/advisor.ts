import './advisor.css';
import { api, ApiError, escapar, formatDate } from '../http';

// Área del asesor: ruta de formación, progreso y acceso a los módulos de contenido.

export type ModuleView = {
  moduleId: string;
  slug: string;
  name: string;
  order: number;
  status: 'NOT_STARTED' | 'AVAILABLE' | 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'BLOCKED';
  progressPercent: string;
  actionLabel: string;
  route: string;
  enabled: boolean;
  blockedReason: string | null;
  waitUntil: string | null;
  missingSeals?: string[];
};

const STATUS_LABEL: Record<ModuleView['status'], string> = {
  NOT_STARTED: 'Sin iniciar',
  AVAILABLE: 'Disponible',
  IN_PROGRESS: 'En curso',
  PASSED: 'Completado',
  FAILED: 'Sin intentos',
  BLOCKED: 'Bloqueado',
};

function statusLabel(module: ModuleView): string {
  return module.actionLabel === 'No disponible' ? 'No disponible' : STATUS_LABEL[module.status];
}

type CardState = 'active' | 'completed' | 'locked' | 'available';

const MODULE_IMAGES: Record<string, string> = {
  'ofimatica-mecanografia': '/imagenes/ofimatica-cobranzas-ilustracion.png',
  'induccion-cobranzas': '/imagenes/induccion-cobranzas-ilustracion.png',
  'simulador-cobranzas': '/imagenes/enfrentate-objecion-ilustracion.png',
  'tipificacion-llamadas': '/imagenes/tipificacion-llamadas-ilustracion.png',
  'certificado': '/imagenes/certificado-ilustracion.png',
};

function stateIcon(state: CardState): string {
  const paths: Record<CardState, string> = {
    active: '<path d="m9 5 7 7-7 7"/>',
    completed: '<path d="m5 12 4 4L19 6"/>',
    locked: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
    available: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[state]}</svg>`;
}

function card(module: ModuleView, current: boolean): string {
  const illustration = MODULE_IMAGES[module.slug];
  const percent = Math.max(0, Math.min(100, Number(module.progressPercent) || 0));
  const state: CardState = module.status === 'PASSED' ? 'completed' : !module.enabled ? 'locked' : current ? 'active' : 'available';
  const label = current
    ? `Estás aquí · ${statusLabel(module)}`
    : state === 'locked' && module.status === 'IN_PROGRESS' ? 'No disponible' : statusLabel(module);
  const button = module.enabled
    ? `<a class="path-card-action" href="${escapar(module.route)}">${escapar(module.actionLabel)} <span aria-hidden="true">→</span></a>`
    : `<button class="path-card-action" type="button" disabled>${stateIcon(state === 'completed' ? 'completed' : 'locked')}${escapar(module.actionLabel)}</button>`;
  const note = module.blockedReason
    ? `<p class="path-card-note">${escapar(module.blockedReason)}</p>`
    : module.waitUntil ? `<p class="path-card-note">Podrás intentarlo de nuevo desde ${escapar(formatDate(module.waitUntil))}.</p>`
      : state === 'locked' ? '<p class="path-card-note">Este módulo aún no está disponible.</p>' : '';
  return `
    <li class="path-card" data-status="${module.status}" data-state="${state}" data-enabled="${module.enabled}"${current ? ' aria-current="step"' : ''}>
      <div class="path-card-top"><span class="path-card-order">MÓDULO ${String(module.order).padStart(2, '0')}</span><span class="path-card-corner${illustration ? ' path-card-corner--illustrated' : ''}">${illustration ? `<img class="path-card-illustration" src="${escapar(illustration)}" alt="" width="1536" height="1024" decoding="async">` : ''}<span class="path-card-state-icon">${stateIcon(state)}</span></span></div>
      <div class="path-card-body">
        <h3>${escapar(module.name)}</h3>
        <span class="path-card-status">${escapar(label)}</span>
        <div class="path-card-progress"><span class="path-card-progress-label">Progreso</span><strong class="path-card-percent">${escapar(module.progressPercent)} %</strong></div>
        <div class="path-card-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}" aria-label="Progreso de ${escapar(module.name)}"><span style="width:${percent}%"></span></div>
        ${state === 'locked' && note ? `<details class="path-card-requirement"><summary>Ver requisito para avanzar</summary>${note}</details>` : note}
      </div>
      ${button}
    </li>`;
}

// Sección "Tu ruta de formación" en la práctica, justo debajo de "Tu camino en Fontana".
export async function mountLearningPath(): Promise<void> {
  const main = document.querySelector('main');
  if (!main) return;
  const camino = main.querySelector('.learning-path');
  const section = document.createElement('section');
  section.className = 'training-route';
  section.setAttribute('aria-labelledby', 'training-route-title');
  section.innerHTML = '<div class="training-route-head"><h2 id="training-route-title">Tu ruta de formación</h2><p>Avanza módulo por módulo. Cada uno se desbloquea al aprobar el anterior.</p></div><p class="training-route-loading">Cargando tus módulos…</p>';
  if (camino) camino.after(section); else main.prepend(section);
  try {
    const { data } = await api<{ data: ModuleView[] }>('/advisor/modules');
    const current = data.find((module) => module.enabled && module.status === 'IN_PROGRESS')
      ?? data.find((module) => module.enabled && (module.status === 'AVAILABLE' || module.status === 'NOT_STARTED'));
    section.insertAdjacentHTML('beforeend', `<ol class="path-cards">${data.map((module) => card(module, module === current)).join('')}</ol>`);
    section.querySelector('.training-route-loading')!.remove();
  } catch (error) {
    section.querySelector('.training-route-loading')!.textContent = (error as Error).message;
  }
}

const INDUCTION_SLUG = 'induccion-cobranzas';
// El módulo 03 conserva su slug técnico; su nombre visible es «Enfréntate a la objeción».
const OBJECTIONS_SLUG = 'simulador-cobranzas';
// El módulo 04 conserva su slug técnico; su nombre visible es «Tipifica».
const TIPIFICA_SLUG = 'tipificacion-llamadas';

// Primera pantalla de «Inducción a las cobranzas»: la experiencia define el camino. Quien es nuevo recorre la
// teoría y luego el examen final; quien tiene experiencia empieza por el mismo examen y, si no lo aprueba, ve la teoría.
function experienceFormHtml(): string {
  return `<form id="experience-form" class="exp-form">
      <p class="auth-kicker">CONOZCAMOS TU EXPERIENCIA</p>
      <h3>¿Cuál es tu punto de partida?</h3>
      <p>Selecciona la opción que mejor describe tu experiencia en cobranzas digitales.</p>
      <div class="exp-options">
        <label class="exp-option"><input type="radio" name="experience" value="experienced" required><span><strong>Tengo experiencia</strong><small>Ya he trabajado en cobranzas digitales. Presentarás el examen final: si lo apruebas, pasas al simulador.</small></span></label>
        <label class="exp-option"><input type="radio" name="experience" value="new" required><span><strong>Soy completamente nuevo</strong><small>Es mi primera experiencia en cobranzas digitales. Verás la teoría paso a paso y luego el examen final.</small></span></label>
      </div>
      <p id="experience-error" class="feedback feedback-error" role="alert" hidden></p>
      <button type="submit" class="primary-action">Confirmar respuesta</button>
    </form>`;
}

// Rutas /induccion/modulos/:slug y /induccion/certificado: el servidor valida el acceso.
export async function renderModulePage(container: HTMLElement, backHref = '/induccion', experience: boolean | null = null): Promise<void> {
  const slug = location.pathname === '/induccion/certificado' ? 'certificado' : decodeURIComponent(location.pathname.split('/')[3] ?? '');
  // Con la experiencia respondida, el módulo propio decide el camino: teoría y examen, o examen primero.
  if (slug === INDUCTION_SLUG && experience !== null) {
    const { mountCollections } = await import('../collections/collections');
    await mountCollections(container, backHref);
    return;
  }
  container.innerHTML = '<section class="auth-card narrow module-page"><p>Cargando módulo…</p></section>';
  const page = container.querySelector<HTMLElement>('.module-page')!;
  try {
    const { data } = await api<{ data: { module: ModuleView; activities: { title: string; enabled: boolean; blockedReason: string | null }[]; content: { message: string } } }>(`/advisor/modules/${encodeURIComponent(slug)}`);
    // El acceso ya se validó arriba (prerrequisitos, estado): el módulo 03 tiene su propia aplicación.
    if (slug === OBJECTIONS_SLUG) {
      const { mountObjections } = await import('../objections/objections');
      await mountObjections(container, backHref);
      return;
    }
    // Módulo 04 «Tipifica»: práctica en el clon de Control Next.
    if (slug === TIPIFICA_SLUG) {
      const { mountTipifica } = await import('../tipifica/tipifica');
      await mountTipifica(container, backHref, data.module.order);
      return;
    }
    page.innerHTML = `
      <p class="auth-kicker">MÓDULO ${String(data.module.order).padStart(2, '0')}</p>
      <h2>${escapar(data.module.name)}</h2>
      ${slug === INDUCTION_SLUG ? experienceFormHtml() : `<div class="module-placeholder"><strong>${escapar(data.content.message)}</strong><p>Este espacio mostrará las actividades del módulo cuando estén listas.</p></div>`}
      ${slug !== INDUCTION_SLUG && data.activities.length ? `<ul class="module-activities">${data.activities.map((activity) => `<li>${escapar(activity.title)}${activity.enabled ? '' : ` · <em>${escapar(activity.blockedReason)}</em>`}</li>`).join('')}</ul>` : ''}
      <a class="secondary-link" href="${escapar(backHref)}">← Volver a tu ruta</a>`;
    page.querySelector<HTMLFormElement>('#experience-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const answer = new FormData(form).get('experience');
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      const error = form.querySelector<HTMLElement>('#experience-error')!;
      button.disabled = true;
      error.hidden = true;
      try {
        await api('/auth/experiencia', { method: 'POST', body: JSON.stringify({ tieneExperienciaCobranzasDigitales: answer === 'experienced' }) });
        await renderModulePage(container, backHref, answer === 'experienced');
      } catch (failure) {
        error.textContent = (failure as Error).message;
        error.hidden = false;
        button.disabled = false;
      }
    });
  } catch (error) {
    const reason = error instanceof ApiError && typeof error.details?.blockedReason === 'string' ? error.details.blockedReason : (error as Error).message;
    page.innerHTML = `
      <p class="auth-kicker">ACCESO NO DISPONIBLE</p>
      <h2>Todavía no puedes entrar a este módulo</h2>
      <p class="feedback feedback-error">${escapar(reason)}</p>
      <a class="secondary-link" href="${escapar(backHref)}">← Volver a tu ruta</a>`;
  }
}
