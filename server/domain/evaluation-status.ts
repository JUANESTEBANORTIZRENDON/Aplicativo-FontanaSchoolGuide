import type { Availability } from './progress.js';

// Estado de una evaluación oficial tal como lo ven el asesor y el administrador. Una sola función para los dos.

export type EvaluationStatus =
  | 'PENDIENTE'
  | 'EN_PROGRESO'
  | 'APROBADO'
  | 'NO_APROBADO'
  | 'SIN_INTENTOS'
  | 'REACTIVACION_SOLICITADA'
  | 'REACTIVADO'
  // Tipifica no se aprueba ni se reprueba: el ejercicio se presenta una vez y se recibe retroalimentación.
  | 'COMPLETADO';

export const EVALUATION_STATUS_LABEL: Record<EvaluationStatus, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROGRESO: 'En progreso',
  APROBADO: 'Aprobado',
  NO_APROBADO: 'No aprobado',
  SIN_INTENTOS: 'Sin intentos disponibles',
  REACTIVACION_SOLICITADA: 'Reactivación solicitada',
  REACTIVADO: 'Reactivado por el administrador',
  COMPLETADO: 'Completado',
};

// NO_APROBADO: envió su intento, no aprobó y no le quedan intentos. SIN_INTENTOS: no le quedan intentos sin haber
// reprobado (por ejemplo, un cupo en cero). REACTIVADO: ya presentó y el administrador le concedió otro intento.
export function evaluationStatusOf(input: {
  availability: Pick<Availability, 'passed' | 'openAttemptId' | 'remaining' | 'nextNumber'> | undefined;
  lastAttemptFailed: boolean;
  pendingRequest: boolean;
}): EvaluationStatus {
  const availability = input.availability;
  if (!availability) return 'PENDIENTE';
  if (availability.passed) return 'APROBADO';
  if (availability.openAttemptId) return availability.nextNumber > 2 ? 'REACTIVADO' : 'EN_PROGRESO';
  if (input.pendingRequest) return 'REACTIVACION_SOLICITADA';
  if (availability.remaining > 0) return availability.nextNumber > 1 ? 'REACTIVADO' : 'PENDIENTE';
  return input.lastAttemptFailed ? 'NO_APROBADO' : 'SIN_INTENTOS';
}
