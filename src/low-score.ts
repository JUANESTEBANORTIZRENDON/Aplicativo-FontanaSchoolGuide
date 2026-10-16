import './low-score.css';

// Por debajo de este porcentaje es prácticamente imposible llegar respondiendo con un mínimo de atención:
// se interpreta como falta de compromiso y no como falta de conocimiento.
export const LOW_SCORE_PERCENT = 10;

export function isLowScore(percent: number): boolean {
  return percent < LOW_SCORE_PERCENT;
}

export function lowScoreAlertHtml(activity: string): string {
  return `<div class="fontana-low-score" role="alert"><strong>Alerta de cumplimiento y responsabilidad</strong>
    <p>Tu resultado en ${activity} quedó por debajo del ${LOW_SCORE_PERCENT} %. Con un mínimo de atención es muy difícil obtener un resultado tan bajo, por lo que esta evaluación no refleja el cumplimiento esperado ni la habilidad que necesitas para tu gestión.</p>
    <p>Dedica el tiempo necesario: lee cada pregunta con calma, repasa el material y vuelve a intentarlo con el compromiso que exige el trabajo con los clientes.</p></div>`;
}
