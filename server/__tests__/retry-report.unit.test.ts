import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
const mocks = vi.hoisted(() => ({ results: vi.fn() }));
vi.mock('../services/evaluation-result.service.js', () => ({ attemptResults: mocks.results }));
import { reportPdf, retryReport, type RetryReport } from '../services/retry-report.service.js';

describe('constancia de evaluación', () => {
  let db: any;
  let attempts: any[];
  beforeEach(() => {
    vi.resetAllMocks();
    const evaluation = (id: string) => ({ activityId: id, minimumScore: new Prisma.Decimal(80), activity: { title: id } });
    attempts = [
      { id: 'failed', number: 2, status: 'FAILED', score: new Prisma.Decimal(40), evaluation: evaluation('final') },
      { id: 'pass', number: 1, status: 'PASSED', score: new Prisma.Decimal(95), evaluation: evaluation('excel') },
      { id: 'older', number: 1, status: 'FAILED', score: new Prisma.Decimal(20), evaluation: evaluation('final') },
    ];
    db = { usuario: { findUnique: vi.fn().mockResolvedValue({ nombreCompleto: 'María Peña', numeroDocumento: 'DEMO' }) }, attempt: { findMany: vi.fn().mockResolvedValue(attempts) } };
    mocks.results.mockResolvedValue(new Map([['failed', { attemptId: 'failed', finalExam: { recommendations: ['Repasa cómo proteger los datos.'] } }]]));
  });
  it('usa notas reales, solo el último intento por prueba y recomendaciones del resultado', async () => {
    const report = await retryReport('advisor', 'final', db);
    expect(report.scores).toEqual([
      { title: 'final', score: '40.00', minimum: '80.00', passed: false },
      { title: 'excel', score: '95.00', minimum: '80.00', passed: true },
    ]);
    expect(report.recommendations).toEqual(['Repasa cómo proteger los datos.']);
    expect(report.attemptNumber).toBe(2);
  });
  it('no emite constancia de refuerzo para una prueba aprobada ni ajena', async () => {
    await expect(retryReport('advisor', 'excel', db)).rejects.toMatchObject({ code: 'RETRY_REPORT_NOT_AVAILABLE' });
    await expect(retryReport('advisor', 'unknown', db)).rejects.toMatchObject({ code: 'RETRY_REPORT_NOT_AVAILABLE' });
  });
  it('Tipifica conserva su puntaje orientativo sin inventar una nota mínima de aprobación', async () => {
    attempts[1].evaluation.activity.type = 'TYPIFICATION';
    attempts[1].score = new Prisma.Decimal(40);
    expect((await retryReport('advisor', 'final', db)).scores[1]).toMatchObject({ score: '40.00', minimum: null, passed: true });
  });
  it('genera PDF paginado, escapa texto y aclara que no acredita aprobación', async () => {
    const report = await retryReport('advisor', 'final', db);
    const buffer = reportPdf({ ...report, name: 'María (Demo) \\ Peña', recommendations: Array(60).fill('Repasa las herramientas con calma y verifica el resultado antes de continuar.') } as RetryReport, 'DEMO-001');
    const pdf = buffer.toString('latin1');
    expect(pdf).toContain('DEMO-001');
    expect(pdf).toContain('\\(Demo\\) \\\\ Pe\\361a');
    expect(pdf).toContain('no acredita aprobaci\\363n');
    expect(Number(/\/Count (\d+)/.exec(pdf)![1])).toBeGreaterThan(1);
    const start = Number(/startxref\n(\d+)/.exec(pdf)![1]);
    expect(pdf.slice(start, start + 4)).toBe('xref');
  });
});
