export function retryScoreLabel(score: { minimum: string | null; passed: boolean }): string {
  if (score.minimum === null) return `Puntaje orientativo · ${score.passed ? 'Completada' : 'Pendiente'}`;
  return `Mínimo ${score.minimum} · ${score.passed ? 'Aprobada' : 'No aprobada'}`;
}
