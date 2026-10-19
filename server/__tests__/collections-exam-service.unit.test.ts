import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COLLECTIONS_KEYS } from '../domain/collections.js';
import { COLLECTIONS_EXAM, EXAM_SECTIONS, EXAM_DRAFT_KEY, EXAM_KEY } from '../domain/collections-exam.js';

// Repositorio en memoria: comprueba el protocolo de guardado sin abrir ni alterar
// la base de desarrollo. Las pruebas de integración cubren la API con PostgreSQL.
const memory = vi.hoisted(() => ({ rows: [] as any[], experienced: false, legacy: false, moduleProgress: null as any }));
vi.mock('../config/prisma.js', () => {
  const db: any = {
    usuario: { findUnique: async () => ({ rol: 'asesor', estado: 'activo', debeCompletarDatos: false, tieneExperienciaCobranzasDigitales: memory.experienced }) },
    $queryRaw: async () => [],
    collectionsBlockProgress: {
      findMany: async ({ where }: any) => memory.rows.filter((row) => where.blockKey.in ? where.blockKey.in.includes(row.blockKey) : row.blockKey.startsWith(where.blockKey.startsWith)),
      upsert: async ({ where, create, update }: any) => {
        const key = where.userId_moduleId_blockKey_contentVersion.blockKey;
        let row = memory.rows.find((item) => item.blockKey === key);
        if (!row) { row = { id: key, attempts: 0, completedAt: null, ...structuredClone(create) }; memory.rows.push(row); }
        else {
          const { attempts, ...data } = update;
          Object.assign(row, structuredClone(data));
          if (attempts?.increment) row.attempts += attempts.increment;
        }
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = memory.rows.find((item) => item.id === where.id);
        Object.assign(row, structuredClone(data)); return row;
      },
      create: async ({ data }: any) => {
        if (memory.rows.some((r) => r.blockKey === data.blockKey)) throw new Error('duplicate');
        const row = { id: data.blockKey, ...structuredClone(data) }; memory.rows.push(row); return row;
      },
    },
    userModuleProgress: { findUnique: async () => memory.moduleProgress },
    userActivityProgress: { findUnique: async () => null },
  };
  db.$transaction = async (callback: (tx: any) => Promise<any>) => callback(db);
  return { prisma: db };
});
vi.mock('../services/progress.service.js', () => ({
  completeModule: vi.fn(async () => { memory.moduleProgress = { ...memory.moduleProgress, status: 'PASSED', percent: 100 }; }),
  loadSnapshot: async () => ({
    views: [{ slug: 'induccion-cobranzas', moduleId: 'module', enabled: true, status: memory.legacy ? 'PASSED' : 'IN_PROGRESS' }],
    modules: [{ id: 'module', activities: [{ id: 'exam-activity', isRequired: true, status: 'ACTIVE' }] }],
  }),
}));
vi.mock('../repositories/progress.repository.js', () => ({
  upsertActivityProgress: vi.fn(),
  upsertModuleProgress: async (_db: unknown, _user: string, _module: string, data: any) => { memory.moduleProgress = data; },
}));
import { collectionsState, startCollectionsExam, saveCollectionsExamSection, submitCollectionsExam } from '../services/collections.service.js';
import { completeModule } from '../services/progress.service.js';

const goodAnswers = () => Object.fromEntries(COLLECTIONS_EXAM.map((q) => [q.key, q.kind === 'text' ? q.example : q.options.find((o) => o.correct)!.id]));
async function saveAll(answers: Record<string, string>) {
  await startCollectionsExam('user');
  for (const section of EXAM_SECTIONS) await saveCollectionsExamSection('user', section.key, Object.fromEntries(section.questions.map((q) => [q.key, answers[q.key]!])));
}
beforeEach(() => {
  memory.rows = COLLECTIONS_KEYS.map((blockKey) => ({ id: blockKey, blockKey, attempts: 0, answers: {}, completedAt: new Date() }));
  memory.experienced = false; memory.legacy = false; memory.moduleProgress = null; vi.clearAllMocks();
});

describe('persistencia del examen por secciones', () => {
  it('exige teoría y bloquea saltos, sin consumir intentos al iniciar', async () => {
    memory.rows = [];
    await expect(startCollectionsExam('user')).rejects.toMatchObject({ code: 'THEORY_REQUIRED' });
    memory.experienced = true;
    const draft = await startCollectionsExam('user');
    expect(draft).toMatchObject({ sectionIndex: 0, answers: {} });
    const section = EXAM_SECTIONS[1]!; const answers = goodAnswers();
    await expect(saveCollectionsExamSection('user', section.key, Object.fromEntries(section.questions.map((q) => [q.key, answers[q.key]!])))).rejects.toMatchObject({ code: 'PREVIOUS_SECTION_REQUIRED' });
    expect((await collectionsState('user')).exam.attempts).toBe(0);
  });

  it('guarda respuestas erróneas sin corregir, permite retomar y admite un reenvío idéntico', async () => {
    await startCollectionsExam('user');
    const answers = { 'inicio-accion': 'saldo', 'inicio-guion': 'No sé.' };
    const draft = await saveCollectionsExamSection('user', 'inicio', answers);
    expect(draft).toMatchObject({ sectionIndex: 1, answers });
    expect(draft).not.toHaveProperty('result'); expect(draft).not.toHaveProperty('score');
    expect(await startCollectionsExam('user')).toEqual(draft);
    expect(await saveCollectionsExamSection('user', 'inicio', answers)).toEqual(draft);
    await expect(saveCollectionsExamSection('user', 'inicio', { ...answers, 'inicio-accion': 'identificar' })).rejects.toMatchObject({ code: 'PREVIOUS_SECTION_REQUIRED' });
    const state = await collectionsState('user');
    expect(state.exam.draft).toEqual(draft); expect(state.exam.lastResult).toBeNull();
    expect(state.completedCount).toBe(5); expect(state.percent).toBe(80);
  });

  it('impide calificar un intento incompleto o alterar las respuestas guardadas', async () => {
    await startCollectionsExam('user');
    await expect(submitCollectionsExam('user', goodAnswers())).rejects.toThrow('siete secciones');
    await saveAll(goodAnswers());
    await expect(submitCollectionsExam('user', { ...goodAnswers(), 'inicio-accion': 'ordenar' })).rejects.toThrow('coincidir');
    expect(memory.rows.find((r) => r.blockKey === EXAM_KEY)).toBeUndefined();
  });

  it('guarda respuestas, versión y resultado en el historial y no duplica el envío final', async () => {
    const answers = goodAnswers();
    answers['negociacion-descuento'] = 'aprobar'; // 92 puntos, pero error crítico.
    await saveAll(answers);
    expect((await collectionsState('user')).exam.lastResult).toBeNull();
    const first = await submitCollectionsExam('user', answers);
    expect(first.result).toMatchObject({ score: 92, passed: false, verdict: 'Requiere refuerzo' });
    expect(first.state.exam.draft).toBeNull();
    expect(first.state.percent).toBe(80);
    expect(memory.rows.find((r) => r.blockKey === 'examen-intento-1').answers).toMatchObject({ version: 2, answers, result: first.result });
    const savedCoaching = memory.rows.find((r) => r.blockKey === 'examen-intento-1').answers.coaching;
    expect(savedCoaching.improvements.find((item: any) => item.key === 'negociacion-descuento')).toMatchObject({ priority: 'critical' });
    expect(savedCoaching.strengths.some((item: any) => item.key === 'negociacion-descuento')).toBe(false);
    expect(memory.rows.find((r) => r.blockKey === EXAM_DRAFT_KEY).answers.status).toBe('submitted');
    const retry = await submitCollectionsExam('user', answers);
    expect(retry.result).toEqual(first.result); expect(retry.state.exam.attempts).toBe(1);
    expect(completeModule).not.toHaveBeenCalled();
  });

  it('completa el módulo al aprobar, conserva la aprobación y archiva un segundo intento distinto', async () => {
    await saveAll(goodAnswers());
    const passed = await submitCollectionsExam('user', goodAnswers());
    expect(passed.state).toMatchObject({ complete: true, percent: 100, completedCount: 5 });
    expect(completeModule).toHaveBeenCalledTimes(1);
    const bad = { ...goodAnswers(), 'inicio-accion': 'saldo' };
    await saveAll(bad);
    const second = await submitCollectionsExam('user', bad);
    expect(second.result.passed).toBe(false);
    expect(second.state.complete).toBe(true);
    expect(second.state.exam.attempts).toBe(2);
    expect(memory.rows.filter((r) => r.blockKey.startsWith('examen-intento-'))).toHaveLength(2);
    expect(completeModule).toHaveBeenCalledTimes(1);
  });

  it('conserva aprobaciones y teoría históricas sin recalificar respuestas del examen anterior', async () => {
    memory.legacy = true;
    memory.rows.push({ id: EXAM_KEY, blockKey: EXAM_KEY, completedAt: new Date(), attempts: 1, answers: { reporte: 'reportado' } });
    const state = await collectionsState('user');
    expect(state.exam).toMatchObject({ passed: true, lastResult: null, draft: null });
    expect(state.completedCount).toBe(5);
  });

  it('no reutiliza números de intento tras reiniciar el progreso conservando el historial', async () => {
    await saveAll(goodAnswers());
    await submitCollectionsExam('user', goodAnswers());
    const archive = memory.rows.filter((row) => row.blockKey.startsWith('examen-intento-'));
    memory.rows = [...COLLECTIONS_KEYS.map((blockKey) => ({ id: blockKey, blockKey, attempts: 0, answers: {}, completedAt: new Date() })), ...archive];
    await saveAll(goodAnswers());
    await submitCollectionsExam('user', goodAnswers());
    expect(memory.rows.filter((row) => row.blockKey.startsWith('examen-intento-')).map((row) => row.blockKey)).toEqual(['examen-intento-1', 'examen-intento-2']);
    expect(memory.rows.find((row) => row.blockKey === 'examen-intento-1')).toEqual(archive[0]);
  });
});
