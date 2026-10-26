import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ pending: vi.fn(), user: vi.fn() }));
vi.mock('../config/prisma.js', () => ({ prisma: { reactivationRequest: { findFirst: mocks.pending } } }));
vi.mock('../repositories/usuario.repository.js', () => ({ findSessionUser: mocks.user }));
vi.mock('../services/session.service.js', () => ({ leerSesion: () => ({ userId: 'advisor', version: 1 }), borrarSesion: vi.fn() }));
import { requireAuth } from '../middleware/auth.js';

describe('espera de aprobación en el servidor', () => {
  const next = vi.fn();
  const call = (method: string, originalUrl: string) => requireAuth({ method, originalUrl } as any, {} as any, next);
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.mockResolvedValue({ id: 'advisor', rol: 'asesor', estado: 'activo', versionSesion: 1 });
    mocks.pending.mockResolvedValue({ id: 'request' });
  });
  it.each(['/API/TrAiNiNg/final-exam/start', '/api/training/office/excel/actions', '/api/training/collections/blocks/conceptos', '/api/auth/induccion/completar', '/api/advisor/certification/celebrated'])('no bloquea globalmente el recorrido por acompañamiento: %s', async url => {
    await call('POST', url);
    expect(next).toHaveBeenCalledOnce();
    expect(mocks.pending).not.toHaveBeenCalled();
  });
  it.each([['GET', '/api/training/retry-status'], ['GET', '/api/training/reactivation-requests/id/report.pdf'], ['POST', '/api/training/reactivation-requests'], ['POST', '/api/auth/logout']])('permite consultar, descargar y cerrar sesión: %s %s', async (method, url) => {
    await call(method!, url!);
    expect(next).toHaveBeenCalledOnce();
    expect(mocks.pending).not.toHaveBeenCalled();
  });
  it('la decisión aprobada o rechazada permite escribir otra vez', async () => {
    mocks.pending.mockResolvedValue(null);
    await call('POST', '/api/training/final-exam/start');
    expect(next).toHaveBeenCalledOnce();
  });
  it('la espera del asesor no bloquea las decisiones del administrador', async () => {
    mocks.user.mockResolvedValue({ id: 'admin', rol: 'administrador', estado: 'activo', versionSesion: 1 });
    await call('POST', '/api/admin/reactivation-requests/id/approve');
    expect(next).toHaveBeenCalledOnce();
    expect(mocks.pending).not.toHaveBeenCalled();
  });
});
