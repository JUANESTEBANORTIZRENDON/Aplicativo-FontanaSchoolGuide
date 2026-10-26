import { describe, expect, it } from 'vitest';
import { failureCertificateHtml } from './evaluation-retry';

describe('constancia de resultado no aprobado', () => {
  it('identifica la evaluación, la nota y el intento sin acreditar formación', () => {
    const html = failureCertificateHtml({ name: '<script>Asesor</script>', activityTitle: 'Examen general', activityId: 'activity', attemptId: 'attempt', attemptNumber: 2,
      issuedAt: '2026-10-26T15:00:00Z', attempts: [{ attemptId: 'attempt', score: '60.00', submittedAt: '2026-10-26T15:00:00Z' }], scores: [], recommendations: [] });
    expect(html).toContain('Aún no apto en esta evaluación');
    expect(html).toContain('Examen general · Intento 2');
    expect(html).toContain('60.00 / 100');
    expect(html).toContain('no acredita la aprobación');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('Descargar');
  });
});
