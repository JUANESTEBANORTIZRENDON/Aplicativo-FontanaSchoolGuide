// Datos fijos de la certificación de Fontana School.

// Nombre de la formación que aparece en el certificado. Pendiente de validar con la empresa.
export const TRAINING_NAME = 'Formación de asesores de cobranzas digitales';
// Versión del plan formativo que se certifica: bienvenida, Ofimática, Inducción a las cobranzas,
// Enfréntate a la objeción, Tipifica (6 ejercicios) y Examen general. Sube si cambia el recorrido.
export const TRAINING_PLAN_VERSION = 1;

export const TRAINING_PROFILE = { NEW: 'NUEVO', EXPERIENCED: 'CON_EXPERIENCIA' } as const;
export type TrainingProfile = (typeof TRAINING_PROFILE)[keyof typeof TRAINING_PROFILE];

export function trainingProfileOf(experienced: boolean | null): TrainingProfile {
  return experienced ? TRAINING_PROFILE.EXPERIENCED : TRAINING_PROFILE.NEW;
}

export const CERTIFICATION_STATUS_LABEL = {
  EN_FORMACION: 'En formación',
  PENDIENTE_VALIDACION: 'Pendiente de validación',
  DEVUELTO: 'Devuelto para corrección',
  CERTIFICADO: 'Certificado',
} as const;
