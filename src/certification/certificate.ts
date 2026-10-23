import './certificate.css';
import '../reactivation.css';
import { api, escapar } from '../http';

// Certificación del asesor: estado (en formación, pendiente de validación, devuelto o certificado), el certificado
// y la felicitación animada que se muestra una sola vez cuando el administrador aprueba.

export type Certification = {
  status: 'EN_FORMACION' | 'PENDIENTE_VALIDACION' | 'DEVUELTO' | 'CERTIFICADO';
  statusLabel: string;
  reason: string | null;
  missing: string[];
  advisorName: string;
  trainingName: string;
  certificate: { code: string; issuedAt: string; celebrated: boolean } | null;
};

const PDF_URL = '/api/advisor/certificate.pdf';

const longDate = (value: string): string => new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));

// Vista del certificado (la misma composición del PDF). La firma institucional queda como espacio reservado.
export function certificateHtml(data: Certification): string {
  const certificate = data.certificate!;
  return `
    <figure class="cert-paper" aria-label="Certificado de ${escapar(data.advisorName)}">
      <div class="cert-paper__frame">
        <div class="cert-seal" aria-hidden="true"><span>FS</span></div>
        <p class="cert-paper__brand">FONTANA SCHOOL</p>
        <h3 class="cert-paper__title">Certificado de formación</h3>
        <p class="cert-paper__muted">Se certifica que</p>
        <p class="cert-paper__name">${escapar(data.advisorName)}</p>
        <p class="cert-paper__muted">completó satisfactoriamente la</p>
        <p class="cert-paper__training">${escapar(data.trainingName)}</p>
        <p class="cert-paper__muted">Bogotá, ${escapar(longDate(certificate.issuedAt))}</p>
        <div class="cert-paper__sign"><span></span><small>Firma institucional</small></div>
        <p class="cert-paper__code">Código de verificación: <strong>${escapar(certificate.code)}</strong></p>
      </div>
    </figure>`;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

// Felicitación: transición, sello, destellos, mensaje, nombre y certificado. Sin video ni librerías.
export function playCelebration(data: Certification, backHref: string): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = `cert-celebration${prefersReducedMotion() ? ' is-reduced' : ''}`;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'cert-celebration-title');
    const sparks = Array.from({ length: 18 }, (_, index) => `<i style="--a:${index * 20}deg;--d:${(index % 6) * 0.12}s"></i>`).join('');
    overlay.innerHTML = `
      <div class="cert-celebration__inner">
        <div class="cert-celebration__seal" aria-hidden="true"><div class="cert-celebration__sparks">${sparks}</div><span>FS</span></div>
        <h2 id="cert-celebration-title" class="cert-celebration__title">¡Felicidades! Has completado tu formación en Fontana School.</h2>
        <p class="cert-celebration__name">${escapar(data.advisorName)}</p>
        <div class="cert-celebration__paper">${certificateHtml(data)}</div>
        <div class="cert-celebration__actions">
          <a class="primary-action" href="${PDF_URL}" download>Descargar certificado (PDF)</a>
          <a class="secondary-action" href="${escapar(backHref)}" data-close>Regresar a los módulos</a>
        </div>
      </div>`;
    const previous = document.activeElement as HTMLElement | null;
    const close = (): void => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      previous?.focus();
      resolve();
    };
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') close(); };
    overlay.querySelector('[data-close]')!.addEventListener('click', (event) => {
      // Si ya está en la ruta, solo cierra la felicitación.
      if (location.pathname === backHref) { event.preventDefault(); close(); }
    });
    document.addEventListener('keydown', onKey);
    document.body.append(overlay);
    overlay.querySelector<HTMLElement>('.cert-celebration__actions a')?.focus({ preventScroll: true });
  });
}

// Espera a que el aula termine de cargar (la pantalla de carga cubre todo mientras tanto).
function appReady(): Promise<void> {
  return new Promise((resolve) => {
    const started = Date.now();
    const check = (): void => {
      if (!document.documentElement.classList.contains('app-loading') || Date.now() - started > 15_000) resolve();
      else setTimeout(check, 150);
    };
    check();
  });
}

// Se llama al consultar el progreso: si el asesor ya fue certificado y aún no vio la felicitación, se la muestra.
export async function celebrateIfNew(backHref: string): Promise<void> {
  try {
    const { data } = await api<{ data: Certification }>('/advisor/certification');
    if (data.status !== 'CERTIFICADO' || !data.certificate || data.certificate.celebrated) return;
    await appReady();
    const shown = playCelebration(data, backHref);
    await api('/advisor/certification/celebrated', { method: 'POST', body: '{}' });
    await shown;
  } catch {
    // La felicitación es opcional: si falla la consulta, el asesor sigue con su ruta.
  }
}

export async function mountCertificatePage(container: HTMLElement, backHref: string): Promise<void> {
  container.innerHTML = '<section class="cert-page"><p role="status">Cargando tu certificación…</p></section>';
  const page = container.querySelector<HTMLElement>('.cert-page')!;
  let data: Certification;
  try {
    data = (await api<{ data: Certification }>('/advisor/certification')).data;
  } catch (error) {
    page.innerHTML = `<p class="feedback feedback-error">${escapar((error as Error).message)}</p><a class="secondary-link" href="${escapar(backHref)}">← Volver a tu ruta</a>`;
    return;
  }
  const back = `<a class="secondary-link" href="${escapar(backHref)}">← Volver a tus módulos</a>`;
  if (data.status === 'CERTIFICADO' && data.certificate) {
    page.innerHTML = `
      <p class="auth-kicker">CERTIFICADO</p>
      <h2>Tu certificado de Fontana School</h2>
      <p>Todos los módulos siguen abiertos para que repases cuando quieras. Lo que practiques no cambia tus resultados oficiales.</p>
      ${certificateHtml(data)}
      <div class="cert-page__actions"><a class="primary-action" href="${PDF_URL}" download>Descargar certificado (PDF)</a><button type="button" class="secondary-action" data-replay>Ver la felicitación</button></div>
      ${back}`;
    page.querySelector('[data-replay]')?.addEventListener('click', () => { void playCelebration(data, backHref); });
    if (!data.certificate.celebrated) {
      await api('/advisor/certification/celebrated', { method: 'POST', body: '{}' }).catch(() => undefined);
      await playCelebration(data, backHref);
    }
    return;
  }
  const body = data.status === 'PENDIENTE_VALIDACION'
    ? '<div class="eval-notice"><strong>Pendiente de validación</strong><p>Completaste tu recorrido y tus evaluaciones. El administrador está revisando tu expediente: cuando apruebe tu certificación, aquí verás tu certificado.</p></div>'
    : data.status === 'DEVUELTO'
      ? `<div class="eval-notice eval-notice--warn"><strong>Devuelto para corrección</strong><p>${escapar(data.reason ?? 'El administrador pidió revisar algunas actividades.')}</p><p>Revisa las actividades señaladas con tu líder. Tus resultados se conservan.</p></div>`
      : `<div class="eval-notice"><strong>Aún estás en formación</strong><p>Para la validación final te falta:</p><ul>${data.missing.map((item) => `<li>${escapar(item)}</li>`).join('')}</ul></div>`;
  page.innerHTML = `<p class="auth-kicker">CERTIFICADO</p><h2>Tu certificación</h2>${body}${back}`;
}
