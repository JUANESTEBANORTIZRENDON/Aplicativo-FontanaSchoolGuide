import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COLLECTIONS_EXAM, gradeExam } from '../domain/collections-exam.js';
import { buildExamCoaching } from '../domain/collections-exam-report.js';

const memory = vi.hoisted(() => ({ rows: [] as any[], user: { id: 'advisor-a', nombreCompleto: 'Asesor A', numeroDocumento: '123', rol: 'asesor' } as any }));
vi.mock('../repositories/usuario.repository.js', () => ({ findPublicById: vi.fn(async () => memory.user) }));
vi.mock('../config/prisma.js', () => {
  const matches = (row: any, where: any) => row.userId === where.userId && row.slug === where.module.slug && (!where.id || row.id === where.id) && (typeof where.blockKey === 'string' ? row.blockKey === where.blockKey : row.blockKey.startsWith(where.blockKey.startsWith));
  return { prisma: { collectionsBlockProgress: {
    findFirst: vi.fn(async ({ where }: any) => memory.rows.find((row) => matches(row, where)) ?? null),
    count: vi.fn(async ({ where }: any) => memory.rows.filter((row) => matches(row, where)).length),
    findMany: vi.fn(async ({ where, take, cursor, skip = 0 }: any) => {
      const rows = memory.rows.filter((row) => matches(row, where)).sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
      const start = cursor ? rows.findIndex((row) => row.id === cursor.id) + skip : 0;
      return rows.slice(start, start + take);
    }),
  } } };
});
import { advisorCollectionsAttempt, advisorCollectionsHistory } from '../services/collections-admin.service.js';

const answers = () => Object.fromEntries(COLLECTIONS_EXAM.map((q) => [q.key, q.kind === 'text' ? q.example : q.options.find((o) => o.correct)!.id]));
function archive(number: number, userId = 'advisor-a', wrong = false) {
  const result = gradeExam({ ...answers(), ...(wrong ? { 'escenario-saldo': '480' } : {}) });
  const date = new Date(Date.UTC(2026, 9, 19, 10, number));
  return { id: `${userId}-${number}`, userId, slug: 'induccion-cobranzas', contentVersion: 1, blockKey: `examen-intento-${number}`, completedAt: date, updatedAt: date, attempts: 1, answers: { version: 2, attempt: number, submittedAt: date.toISOString(), answers: answers(), result, coaching: buildExamCoaching(result) } };
}
beforeEach(() => {
  memory.rows = [archive(1), archive(2, 'advisor-a', true), archive(1, 'advisor-b')];
  memory.user = { id: 'advisor-a', nombreCompleto: 'Asesor A', numeroDocumento: '123', rol: 'asesor' };
});

describe('consulta administrativa por asesor', () => {
  it('vincula nombre, fecha, intento, resultado y siete puntajes sin incluir otros perfiles', async () => {
    const history = await advisorCollectionsHistory('advisor-a');
    expect(history.advisor).toEqual({ id: 'advisor-a', name: 'Asesor A', document: '123' });
    expect(history.total).toBe(2); expect(history.items.map((i) => i.attempt)).toEqual([2, 1]);
    expect(history.items[0]).toMatchObject({ score: 95, verdict: 'Apto', version: 2, submittedAt: '2026-10-19T10:02:00.000Z' });
    expect(history.items[0]!.sections).toHaveLength(7);
    expect(history.items.some((i) => i.id.startsWith('advisor-b'))).toBe(false);
    await expect(advisorCollectionsAttempt('advisor-a', 'advisor-b-1')).rejects.toMatchObject({ code: 'EXAM_ATTEMPT_NOT_FOUND' });
  });

  it('entrega el informe congelado del intento, con sus recomendaciones y evidencia', async () => {
    const row = memory.rows[1];
    row.answers.coaching.improvements[0].recommendation = 'Refuerzo guardado al enviar este intento.';
    const detail = await advisorCollectionsAttempt('advisor-a', row.id);
    expect(detail.coachingSaved).toBe(true);
    expect(detail.coaching!.improvements[0]!.recommendation).toBe('Refuerzo guardado al enviar este intento.');
    expect(detail.coaching!.improvements[0]!.evidence).toBe('$480.000.');
    expect(detail.result!.score).toBe(95);
    expect(memory.rows[1]).toEqual(row);
  });

  it('permite recorrer todo el historial sin perder intentos entre páginas', async () => {
    memory.rows = Array.from({ length: 23 }, (_, index) => archive(index + 1));
    const first = await advisorCollectionsHistory('advisor-a');
    expect(first.total).toBe(23); expect(first.items).toHaveLength(20); expect(first.nextCursor).not.toBeNull();
    const second = await advisorCollectionsHistory('advisor-a', first.nextCursor!);
    expect(second.items).toHaveLength(3); expect(second.nextCursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(23);
    await expect(advisorCollectionsHistory('advisor-a', 'advisor-b-1')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('construye recomendaciones de registros anteriores sin cambiar el puntaje guardado', async () => {
    delete memory.rows[1].answers.coaching;
    const detail = await advisorCollectionsAttempt('advisor-a', 'advisor-a-2');
    expect(detail.coachingSaved).toBe(false); expect(detail.score).toBe(95);
    expect(detail.coaching!.improvements[0]!.key).toBe('escenario-saldo');
    expect(memory.rows[1].answers).not.toHaveProperty('coaching');
  });

  it('conserva registros incompletos sin inventar resultados y avisa de formatos previos', async () => {
    memory.rows[0].answers.result = { score: 100 };
    const detail = await advisorCollectionsAttempt('advisor-a', 'advisor-a-1');
    expect(detail).toMatchObject({ score: null, verdict: null, result: null, detailAvailable: false });
    memory.rows.push({ userId: 'advisor-a', slug: 'induccion-cobranzas', id: 'legacy', blockKey: 'examen', attempts: 2, answers: { reporte: 'reportado' } });
    expect((await advisorCollectionsHistory('advisor-a')).legacyNotice).toContain('formato anterior');
  });

  it('no entrega informes para usuarios inexistentes o con otro rol', async () => {
    memory.user = null;
    await expect(advisorCollectionsHistory('missing')).rejects.toMatchObject({ code: 'ADVISOR_NOT_FOUND' });
    memory.user = { rol: 'administrador' };
    await expect(advisorCollectionsAttempt('admin', 'advisor-a-1')).rejects.toMatchObject({ code: 'ADVISOR_NOT_FOUND' });
  });
});
