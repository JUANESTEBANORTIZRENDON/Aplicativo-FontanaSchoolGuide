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
  PASSED: 'Aprobado',
  FAILED: 'Sin intentos',
  BLOCKED: 'Bloqueado',
};

function statusLabel(module: ModuleView): string {
  return module.actionLabel === 'No disponible' ? 'No disponible' : STATUS_LABEL[module.status];
}

function card(module: ModuleView): string {
  const percent = Math.max(0, Math.min(100, Number(module.progressPercent) || 0));
  const button = module.enabled
    ? `<a class="path-card-action" href="${escapar(module.route)}">${escapar(module.actionLabel)} <span aria-hidden="true">→</span></a>`
    : `<button class="path-card-action" type="button" disabled>${escapar(module.actionLabel)}</button>`;
  const note = module.blockedReason
    ? `<p class="path-card-note">${escapar(module.blockedReason)}</p>`
    : module.waitUntil ? `<p class="path-card-note">Podrás intentarlo de nuevo desde ${escapar(formatDate(module.waitUntil))}.</p>` : '';
  return `
    <li class="path-card" data-status="${module.status}">
      <span class="path-card-order">${String(module.order).padStart(2, '0')}</span>
      <div class="path-card-body">
        <h3>${escapar(module.name)}</h3>
        <span class="path-card-status">${escapar(statusLabel(module))}</span>
        <div class="path-card-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}" aria-label="Progreso de ${escapar(module.name)}"><span style="width:${percent}%"></span></div>
        <small>${escapar(module.progressPercent)} %</small>
        ${note}
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
    section.querySelector('.training-route-loading')!.remove();
    section.insertAdjacentHTML('beforeend', `<ol class="path-cards">${data.map(card).join('')}</ol>`);
  } catch (error) {
    section.querySelector('.training-route-loading')!.textContent = (error as Error).message;
  }
}

const INDUCTION_SLUG = 'induccion-cobranzas';

// Primera pantalla de «Inducción a las cobranzas»: la experiencia define el camino. Quien es nuevo recibe la
// introducción y luego el examen; quien tiene experiencia va directo al examen (el mismo que hacen los nuevos).
function inductionHtml(experience: boolean | null): string {
  if (experience === null) {
    return `<form id="experience-form" class="exp-form">
      <p class="auth-kicker">CONOZCAMOS TU EXPERIENCIA</p>
      <h3>¿Cuál es tu punto de partida?</h3>
      <p>Selecciona la opción que mejor describe tu experiencia en cobranzas digitales.</p>
      <div class="exp-options">
        <label class="exp-option"><input type="radio" name="experience" value="experienced" required><span><strong>Tengo experiencia</strong><small>Ya he trabajado en cobranzas digitales.</small></span></label>
        <label class="exp-option"><input type="radio" name="experience" value="new" required><span><strong>Soy completamente nuevo</strong><small>Es mi primera experiencia en cobranzas digitales.</small></span></label>
      </div>
      <p id="experience-error" class="feedback feedback-error" role="alert" hidden></p>
      <button type="submit" class="primary-action">Confirmar respuesta</button>
    </form>`;
  }
  const steps = experience ? ['Examen de inducción'] : ['Introducción a las cobranzas', 'Examen de inducción'];
  return `<div class="exp-plan">
    <p class="auth-kicker">TU CAMINO EN ESTE MÓDULO</p>
    <p>${experience ? 'Como ya tienes experiencia, vas directo al examen de inducción.' : 'Como eres nuevo, primero verás la introducción a las cobranzas y luego presentarás el examen de inducción.'}</p>
    <ol class="exp-steps">${steps.map((step) => `<li>${escapar(step)} <em>· contenido en preparación</em></li>`).join('')}</ol>
    <p class="exp-note">Al aprobar el examen se habilita el módulo «Simulador de cobranzas».</p>
  </div>`;
}

// Rutas /induccion/modulos/:slug y /induccion/certificado: el servidor valida el acceso.
export async function renderModulePage(container: HTMLElement, backHref = '/induccion', experience: boolean | null = null): Promise<void> {
  const slug = location.pathname === '/induccion/certificado' ? 'certificado' : decodeURIComponent(location.pathname.split('/')[3] ?? '');
  if (slug === INDUCTION_SLUG && experience === false) {
    const { mountCollections } = await import('../collections/collections');
    await mountCollections(container, backHref);
    return;
  }
  container.innerHTML = '<section class="auth-card narrow module-page"><p>Cargando módulo…</p></section>';
  const page = container.querySelector<HTMLElement>('.module-page')!;
  try {
    const { data } = await api<{ data: { module: ModuleView; activities: { title: string; enabled: boolean; blockedReason: string | null }[]; content: { message: string } } }>(`/advisor/modules/${encodeURIComponent(slug)}`);
    page.innerHTML = `
      <p class="auth-kicker">MÓDULO ${String(data.module.order).padStart(2, '0')}</p>
      <h2>${escapar(data.module.name)}</h2>
      ${slug === INDUCTION_SLUG ? inductionHtml(experience) : `<div class="module-placeholder"><strong>${escapar(data.content.message)}</strong><p>Este espacio mostrará las actividades del módulo cuando estén listas.</p></div>`}
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
