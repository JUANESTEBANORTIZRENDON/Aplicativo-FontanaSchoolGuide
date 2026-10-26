import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
const mocks = vi.hoisted(() => ({ existing: vi.fn(), requirements: vi.fn(), snapshot: vi.fn(), create: vi.fn(), compact: vi.fn(), audit: vi.fn() }));
vi.mock('../services/certification.service.js', () => ({ certificationRequirements: mocks.requirements, compactTraining: mocks.compact }));
vi.mock('../services/progress.service.js', () => ({ loadSnapshot: mocks.snapshot }));
vi.mock('../services/certificate.service.js', () => ({ createWithUniqueCode: mocks.create }));
vi.mock('../services/audit.service.js', () => ({ audit: mocks.audit }));
import { certifyAfterFinalExam } from '../services/automatic-certification.service.js';
const tx = { certificate: { findFirst: mocks.existing } } as unknown as Prisma.TransactionClient;
const now = new Date('2026-10-23T18:00:00Z');
const certificate = { id: 'certificate', userId: 'advisor', code: 'FSG-2026-ABC234', status: 'ACTIVE', issuedAt: now };
describe('certificación automática después del examen general', () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.existing.mockResolvedValue(null); mocks.requirements.mockResolvedValue({met:true,missing:[]});
    mocks.snapshot.mockResolvedValue({}); mocks.create.mockResolvedValue(certificate); mocks.compact.mockResolvedValue({id:'summary'});
  });
  it('emite un certificado con resumen y auditoría sin inventar un aprobador', async () => {
    expect(await certifyAfterFinalExam(tx, 'advisor', now)).toEqual(certificate);
    expect(mocks.requirements).toHaveBeenCalledWith(tx, 'advisor', {});
    expect(mocks.compact).toHaveBeenCalledWith(tx, 'advisor', certificate, null);
    expect(mocks.audit).toHaveBeenCalledWith(tx, {actorUserId:'advisor'}, expect.objectContaining({action:'CERTIFICATE_ISSUED',after:expect.objectContaining({automatic:true})}));
  });
  it('no emite si falta un sello, una actividad o el examen aprobado', async () => {
    mocks.requirements.mockResolvedValue({met:false,missing:['Examen general']});
    expect(await certifyAfterFinalExam(tx,'advisor',now)).toBeNull();
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.compact).not.toHaveBeenCalled();
  });
  it('reintentar devuelve el certificado existente sin duplicar el resumen', async () => {
    mocks.existing.mockResolvedValue(certificate);
    expect(await certifyAfterFinalExam(tx,'advisor',now)).toEqual(certificate);
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.compact).not.toHaveBeenCalled();
  });
  it('respeta la anulación administrativa y no reemite automáticamente', async () => {
    mocks.existing.mockResolvedValue({...certificate,status:'REVOKED'});
    expect(await certifyAfterFinalExam(tx,'advisor',now)).toBeNull(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it('propaga errores para que la transacción del examen se revierta completa', async () => {
    mocks.compact.mockRejectedValue(new Error('Database unavailable'));
    await expect(certifyAfterFinalExam(tx,'advisor',now)).rejects.toThrow('Database unavailable');
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
