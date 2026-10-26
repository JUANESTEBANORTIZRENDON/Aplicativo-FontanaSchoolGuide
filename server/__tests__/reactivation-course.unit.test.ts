import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  restart: vi.fn(), override: vi.fn(), audit: vi.fn(), snapshot: vi.fn(), report: vi.fn(),
  tx: { $queryRaw: vi.fn(), reactivationRequest: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    usuario: { findUnique: vi.fn() }, attempt: { findFirst: vi.fn() }, userActivityOverride: { findUnique: vi.fn() } },
}));
vi.mock('../config/prisma.js', () => ({ prisma: { $transaction: async (fn: any) => fn(mocks.tx) } }));
vi.mock('../services/course-retry.service.js', () => ({ restartCourseForRetry: mocks.restart, jsonSnapshot: (x: unknown) => x }));
vi.mock('../services/override.service.js', () => ({ createOverrideTx: mocks.override }));
vi.mock('../services/audit.service.js', () => ({ audit: mocks.audit }));
vi.mock('../services/attempt.service.js', () => ({ assertNotCertified: vi.fn() }));
vi.mock('../services/progress.service.js', () => ({ loadSnapshot: mocks.snapshot }));
vi.mock('../services/retry-report.service.js', () => ({ retryReport: mocks.report }));
vi.mock('../services/evaluation-result.service.js', () => ({ attemptResults: vi.fn() }));
import { approveReactivation, rejectReactivation, requestReactivation } from '../services/reactivation.service.js';

describe('acompañamiento y reactivación de una sola evaluación', () => {
  let row: any;
  const context = { actorUserId: 'admin' };
  beforeEach(() => {
    vi.resetAllMocks();
    row = { id: 'request', userId: 'advisor', activityId: 'activity', status: 'PENDING', restartCourse: true,
      createdAt: new Date(), user: { id: 'advisor', nombreCompleto: 'Asesor', numeroDocumento: 'DEMO' },
      activity: { id: 'activity', title: 'Examen', module: { slug: 'examen-general', name: 'Examen general', order: 5 } }, decidedBy: null };
    mocks.tx.reactivationRequest.findUnique.mockImplementation(async (args: any) => args.select ? { userId: row.userId } : row);
    mocks.tx.usuario.findUnique.mockResolvedValue({ rol: 'administrador' });
    mocks.tx.reactivationRequest.update.mockImplementation(async (args: any) => ({ ...row, ...args.data }));
    mocks.override.mockResolvedValue({ id: 'override' });
    mocks.tx.userActivityOverride.findUnique.mockResolvedValue({ id: 'self-retry' });
  });
  it('resuelve incluso una solicitud antigua habilitando solo esa prueba y sin reiniciar', async () => {
    const result = await approveReactivation('request', 'Nuevo recorrido', context);
    expect(result).toMatchObject({ status: 'APPROVED', restartCourse: false, overrideId: 'override' });
    expect(mocks.override).toHaveBeenCalledWith(mocks.tx, 'advisor', 'activity', { action: 'REACTIVATE', reason: 'Nuevo recorrido', extraAttempts: 1 }, 'reactivation-request:request', context, expect.any(Date));
    expect(mocks.override.mock.invocationCallOrder[0]).toBeLessThan(mocks.tx.reactivationRequest.update.mock.invocationCallOrder[0]!);
    expect(mocks.restart).not.toHaveBeenCalled();
  });
  it('un doble clic en una solicitud aprobada nunca reinicia por segunda vez', async () => {
    row.status = 'APPROVED';
    expect((await approveReactivation('request', 'Nuevo recorrido', context)).status).toBe('APPROVED');
    expect(mocks.restart).not.toHaveBeenCalled();
    expect(mocks.tx.reactivationRequest.update).not.toHaveBeenCalled();
  });
  it('si no se habilita el intento no registra una aprobación exitosa', async () => {
    mocks.override.mockRejectedValue(new Error('Error al habilitar'));
    await expect(approveReactivation('request', 'Nuevo recorrido', context)).rejects.toThrow('Error al habilitar');
    expect(mocks.tx.reactivationRequest.update).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it('conserva la reactivación de una sola actividad para las solicitudes históricas', async () => {
    row.restartCourse = false;
    expect((await approveReactivation('request', 'Intento antiguo', context)).overrideId).toBe('override');
    expect(mocks.restart).not.toHaveBeenCalled();
    expect(mocks.override).toHaveBeenCalled();
  });
  it('rechazar conserva todos los módulos y registra el motivo', async () => {
    const result = await rejectReactivation('request', 'Primero completa el refuerzo', context);
    expect(result).toMatchObject({ status: 'REJECTED', decisionReason: 'Primero completa el refuerzo' });
    expect(mocks.restart).not.toHaveBeenCalled();
    expect(mocks.override).not.toHaveBeenCalled();
  });
  it.each(['approve', 'reject'])('exige administrador también en el servicio: %s', async decision => {
    mocks.tx.usuario.findUnique.mockResolvedValue({ rol: 'asesor' });
    const action = decision === 'approve' ? approveReactivation : rejectReactivation;
    await expect(action('request', 'Decisión inválida', context)).rejects.toMatchObject({ code: 'ADMIN_REQUIRED' });
    expect(mocks.restart).not.toHaveBeenCalled();
  });
  it('reutiliza la pendiente del asesor y no crea otra ni cambia su informe', async () => {
    mocks.tx.reactivationRequest.findFirst.mockResolvedValue(row);
    expect(await requestReactivation('advisor', 'activity', null)).toMatchObject({ created: false, request: { id: 'request' } });
    expect(mocks.tx.reactivationRequest.create).not.toHaveBeenCalled();
  });
  it('solo crea la solicitud y su informe para una prueba agotada no aprobada', async () => {
    mocks.tx.reactivationRequest.findFirst.mockResolvedValue(null);
    mocks.snapshot.mockResolvedValue({ availability: new Map([['activity', { exhausted: true }]]), modules: [{ activities: [{ id: 'activity', type: 'QUIZ' }] }] });
    mocks.tx.attempt.findFirst.mockResolvedValue({ id: 'attempt' });
    mocks.report.mockResolvedValue({ attemptId: 'attempt', scores: [{ score: '40.00' }] });
    mocks.tx.reactivationRequest.create.mockResolvedValue(row);
    await requestReactivation('advisor', 'activity', 'Quiero repasar');
    expect(mocks.tx.reactivationRequest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      restartCourse: false, report: { attemptId: 'attempt', scores: [{ score: '40.00' }] },
    }) }));
    expect(mocks.restart).not.toHaveBeenCalled();
  });
  it('no abre un recorrido de reintento por una evaluación aprobada', async () => {
    mocks.tx.reactivationRequest.findFirst.mockResolvedValue(null);
    mocks.snapshot.mockResolvedValue({ availability: new Map([['activity', { exhausted: false, passed: true }]]), modules: [{ activities: [{ id: 'activity', type: 'QUIZ' }] }] });
    await expect(requestReactivation('advisor', 'activity', null)).rejects.toMatchObject({ code: 'REACTIVATION_NOT_NEEDED' });
    expect(mocks.tx.reactivationRequest.create).not.toHaveBeenCalled();
  });
  it('no permite saltarse el reintento propio solicitando acompañamiento antes', async () => {
    mocks.tx.reactivationRequest.findFirst.mockResolvedValue(null);
    mocks.tx.userActivityOverride.findUnique.mockResolvedValue(null);
    mocks.snapshot.mockResolvedValue({ availability: new Map([['activity', { exhausted: true }]]), modules: [{ activities: [{ id: 'activity', type: 'QUIZ' }] }] });
    await expect(requestReactivation('advisor', 'activity', null)).rejects.toMatchObject({ code: 'SELF_RETRY_AVAILABLE' });
    expect(mocks.tx.reactivationRequest.create).not.toHaveBeenCalled();
  });
});
