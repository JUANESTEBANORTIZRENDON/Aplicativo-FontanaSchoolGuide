import './reactivation.css';
import { api, escapar, formatDate } from './http';

// Pantalla común cuando un asesor agota su intento oficial sin aprobar: resultado, siguiente paso y el botón
// «Solicitar reactivación». La solicitud queda en el servidor (una pendiente por actividad).

export type EvaluationStatus = 'PENDIENTE' | 'EN_PROGRESO' | 'APROBADO' | 'NO_APROBADO' | 'SIN_INTENTOS' | 'REACTIVACION_SOLICITADA' | 'REACTIVADO';

export const STATUS_TONE: Record<EvaluationStatus, 'neutral' | 'info' | 'ok' | 'bad' | 'warn'> = {
  PENDIENTE: 'neutral', EN_PROGRESO: 'info', APROBADO: 'ok', NO_APROBADO: 'bad', SIN_INTENTOS: 'bad', REACTIVACION_SOLICITADA: 'warn', REACTIVADO: 'info',
};

export function statusChip(status: EvaluationStatus, label: string): string {
  return `<span class="eval-chip eval-chip--${STATUS_TONE[status]}">${escapar(label)}</span>`;
}

type Options = { activityId: string; status: EvaluationStatus; requestedAt?: string | null; title?: string };

// Devuelve el HTML del aviso; llamar a bindReactivation(container) para activar el botón.
export function reactivationNotice(options: Options): string {
  if (options.status === 'REACTIVACION_SOLICITADA') {
    return `<div class="eval-notice eval-notice--warn" role="status"><strong>Reactivación solicitada</strong><p>Enviaste la solicitud${options.requestedAt ? ` el ${escapar(formatDate(options.requestedAt))}` : ''}. El administrador revisará tu resultado y te habilitará un nuevo intento si lo autoriza.</p></div>`;
  }
  if (options.status !== 'NO_APROBADO' && options.status !== 'SIN_INTENTOS') return '';
  return `<div class="eval-notice eval-notice--bad" role="alert" data-reactivation="${escapar(options.activityId)}">
      <strong>${escapar(options.title ?? 'Actividad no aprobada')}</strong>
      <p>Has finalizado tu intento de evaluación. Para volver a presentar esta actividad necesitas una autorización del administrador.</p>
      <label class="eval-notice__note">Comentario para el administrador (opcional)<textarea maxlength="500" rows="2" data-reactivation-note placeholder="Ej.: me equivoqué al elegir el perfil."></textarea></label>
      <p class="eval-notice__error" role="alert" hidden data-reactivation-error></p>
      <button type="button" class="primary-action eval-notice__button" data-reactivation-send>Solicitar reactivación</button>
    </div>`;
}

export function bindReactivation(container: HTMLElement, onRequested: () => void): void {
  container.querySelectorAll<HTMLElement>('[data-reactivation]').forEach((box) => {
    const button = box.querySelector<HTMLButtonElement>('[data-reactivation-send]')!;
    const error = box.querySelector<HTMLElement>('[data-reactivation-error]')!;
    button.addEventListener('click', async () => {
      button.disabled = true;
      error.hidden = true;
      button.textContent = 'Enviando…';
      try {
        const note = box.querySelector<HTMLTextAreaElement>('[data-reactivation-note]')?.value.trim();
        await api('/training/reactivation-requests', { method: 'POST', body: JSON.stringify({ activityId: box.dataset.reactivation, ...(note ? { note } : {}) }) });
        onRequested();
      } catch (cause) {
        error.textContent = (cause as Error).message;
        error.hidden = false;
        button.disabled = false;
        button.textContent = 'Solicitar reactivación';
      }
    });
  });
}
