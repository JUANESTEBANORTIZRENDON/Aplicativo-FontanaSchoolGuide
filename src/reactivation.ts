import './reactivation.css';
import { escapar } from './http';
import { bindEvaluationRetry } from './evaluation-retry';

// Pantalla común cuando un asesor agota su intento oficial sin aprobar: resultado, siguiente paso y el botón
// «Solicitar reactivación». La solicitud queda en el servidor (una pendiente por actividad).

export type EvaluationStatus = 'PENDIENTE' | 'EN_PROGRESO' | 'APROBADO' | 'NO_APROBADO' | 'SIN_INTENTOS' | 'REACTIVACION_SOLICITADA' | 'REACTIVADO' | 'COMPLETADO';

export const STATUS_TONE: Record<EvaluationStatus, 'neutral' | 'info' | 'ok' | 'bad' | 'warn'> = {
  PENDIENTE: 'neutral', EN_PROGRESO: 'info', APROBADO: 'ok', NO_APROBADO: 'bad', SIN_INTENTOS: 'bad', REACTIVACION_SOLICITADA: 'warn', REACTIVADO: 'info', COMPLETADO: 'ok',
};

export function statusChip(status: EvaluationStatus, label: string): string {
  return `<span class="eval-chip eval-chip--${STATUS_TONE[status]}">${escapar(label)}</span>`;
}

type Options = { activityId: string; status: EvaluationStatus; requestedAt?: string | null; title?: string };

// Devuelve el HTML del aviso; llamar a bindReactivation(container) para activar el botón.
export function reactivationNotice(options: Options): string {
  if (!['NO_APROBADO', 'SIN_INTENTOS', 'REACTIVACION_SOLICITADA'].includes(options.status)) return '';
  return `<section class="eval-notice eval-notice--bad" data-reactivation="${escapar(options.activityId)}" hidden></section>`;
}

export function bindReactivation(container: HTMLElement, onRequested: () => void): void {
  container.querySelectorAll<HTMLElement>('[data-reactivation]').forEach(box => bindEvaluationRetry(box, onRequested));
}
