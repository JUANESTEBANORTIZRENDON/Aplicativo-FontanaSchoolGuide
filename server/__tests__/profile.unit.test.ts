import { describe, expect, it, vi, beforeEach } from 'vitest';
import { completarDatosBody } from '../validators/auth.validator.js';
import type { AuthUser } from '../domain/usuario.js';

const mocks = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock('../config/prisma.js', () => ({ prisma: { usuario: { update: mocks.update } } }));
import { completarDatos } from '../services/auth.service.js';

const form = {
  nombre: 'Ana María', apellidos: 'Pérez Gómez', tipoDocumento: 'CC', numeroDocumento: '0012345678',
  fechaNacimiento: '1995-05-20', sexo: 'Femenino', tipoSangre: 'AB-', tallaCamisa: 'M',
  direccionResidencia: 'Calle 10 # 20-30', nombreContactoEmergencia: 'Luis Pérez',
  numeroContactoEmergencia: '+57 3001234567', banco: 'Bancolombia', numeroCuenta: '000123456789',
  correo: 'ana@example.test', telefono: '',
};

describe('perfil de ingreso del asesor', () => {
  beforeEach(() => mocks.update.mockReset());

  it('conserva ceros iniciales y valida las opciones', () => {
    expect(completarDatosBody.parse(form)).toMatchObject({ numeroDocumento: '0012345678', numeroCuenta: '000123456789' });
    for (const [field, value] of Object.entries({ tipoDocumento: 'Pasaporte', sexo: 'otro', tipoSangre: 'C+', tallaCamisa: 'desconocida', banco: 'inventado' })) {
      expect(completarDatosBody.safeParse({ ...form, [field]: value }).success).toBe(false);
    }
  });

  it('exige los campos y rechaza fechas y números inválidos', () => {
    for (const field of Object.keys(form).filter((key) => key !== 'telefono')) {
      expect(completarDatosBody.safeParse({ ...form, [field]: '' }).success).toBe(false);
    }
    for (const fechaNacimiento of ['2099-01-01', '2025-02-29', '2026-02-30']) {
      expect(completarDatosBody.safeParse({ ...form, fechaNacimiento }).success).toBe(false);
    }
    expect(completarDatosBody.safeParse({ ...form, numeroCuenta: '123ABC' }).success).toBe(false);
    expect(completarDatosBody.safeParse({ ...form, numeroContactoEmergencia: 'abc' }).success).toBe(false);
  });

  it('exige el nombre del banco al elegir Otros', () => {
    expect(completarDatosBody.safeParse({ ...form, banco: 'Otros' }).success).toBe(false);
    expect(completarDatosBody.safeParse({ ...form, banco: 'Otros', otroBanco: 'Banco de prueba' }).success).toBe(true);
  });

  it('guarda todos los campos juntos y completa el perfil', async () => {
    mocks.update.mockResolvedValue({ id: 'asesor' });
    await completarDatos({ id: 'asesor' } as AuthUser, completarDatosBody.parse({ ...form, otroBanco: 'valor antiguo' }));
    expect(mocks.update.mock.calls[0]![0]).toMatchObject({
      where: { id: 'asesor' },
      data: { ...form, telefono: null, nombreCompleto: 'Ana María Pérez Gómez', fechaNacimiento: new Date('1995-05-20T00:00:00.000Z'), otroBanco: null, debeCompletarDatos: false },
    });
  });

  it('guarda el nombre personalizado al elegir Otros', async () => {
    mocks.update.mockResolvedValue({ id: 'asesor' });
    await completarDatos({ id: 'asesor' } as AuthUser, completarDatosBody.parse({ ...form, banco: 'Otros', otroBanco: 'Mi banco' }));
    expect(mocks.update.mock.calls[0]![0].data.otroBanco).toBe('Mi banco');
  });
});
