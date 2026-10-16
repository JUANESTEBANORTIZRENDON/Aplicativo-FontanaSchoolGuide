import { icon } from './icons';

export const TRAINING_NOTICE_TEXT =
  'Simulador de capacitación — Datos ficticios. No corresponde a un sistema productivo.';

/** Leyenda de capacitación. `strip`: franja bajo el encabezado; `inline`: dentro de una tarjeta. */
export function trainingNoticeTemplate(variant: 'strip' | 'inline', guide = 'comun.aviso'): string {
  return `
    <p class="sim-training-notice sim-training-notice--${variant}" data-sim-guide="${guide}">
      ${icon('GraduationCap')}<span>${TRAINING_NOTICE_TEXT}</span>
    </p>`;
}
