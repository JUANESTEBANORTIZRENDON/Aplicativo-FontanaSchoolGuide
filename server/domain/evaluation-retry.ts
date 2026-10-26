// El cupo base es un intento. El segundo requiere la acción expresa del asesor;
// los siguientes solo se habilitan mediante una excepción administrativa.
export const EVALUATION_BASE_ATTEMPTS = 1;
export const selfRetryKey = (userId: string, activityId: string): string => `self-retry:${userId}:${activityId}`;

export function initialEvaluation<T extends { maxAttempts: number; waitMinutes: number }>(evaluation: T): T {
  return { ...evaluation, maxAttempts: EVALUATION_BASE_ATTEMPTS, waitMinutes: 0 };
}
