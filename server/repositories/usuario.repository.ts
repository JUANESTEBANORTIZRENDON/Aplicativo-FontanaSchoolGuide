import { Prisma } from '@prisma/client';
import { prisma, type Db } from '../config/prisma.js';
import { ADMIN_ROLE_ALIASES, Role, UserStatus } from '../domain/enums.js';
import type { Cursor } from '../utils/cursor.js';

// Selección del usuario autenticado: sin passwordHash.
export const usuarioSesionSelect = {
  nombre: true,
  apellidos: true,
  fechaNacimiento: true,
  sexo: true,
  tipoSangre: true,
  tallaCamisa: true,
  direccionResidencia: true,
  nombreContactoEmergencia: true,
  numeroContactoEmergencia: true,
  banco: true,
  otroBanco: true,
  numeroCuenta: true,
  id: true,
  nombreCompleto: true,
  tipoDocumento: true,
  numeroDocumento: true,
  correo: true,
  telefono: true,
  rol: true,
  estado: true,
  debeCompletarDatos: true,
  debeCambiarPassword: true,
  tieneExperienciaCobranzasDigitales: true,
  fechaHistoriaCompletada: true,
  fechaMetodoCompletado: true,
  versionSesion: true,
} as const satisfies Prisma.UsuarioSelect;

// Selección pública para el panel administrativo.
export const usuarioPublicoSelect = {
  id: true,
  nombreCompleto: true,
  tipoDocumento: true,
  numeroDocumento: true,
  correo: true,
  telefono: true,
  rol: true,
  estado: true,
  debeCompletarDatos: true,
  debeCambiarPassword: true,
  tieneExperienciaCobranzasDigitales: true,
  fechaCreacion: true,
  ultimoAcceso: true,
} as const satisfies Prisma.UsuarioSelect;

export type UsuarioPublico = Prisma.UsuarioGetPayload<{ select: typeof usuarioPublicoSelect }>;

export function findSessionUser(id: string) {
  return prisma.usuario.findUnique({ where: { id }, select: usuarioSesionSelect });
}

export function findPublicById(db: Db, id: string) {
  return db.usuario.findUnique({ where: { id }, select: usuarioPublicoSelect });
}

// Para inicio de sesión: incluye passwordHash, nunca se devuelve al cliente.
export function findForLogin(identificador: string, tipo: 'asesor' | 'administrador') {
  return prisma.usuario.findFirst({
    where: tipo === Role.ADVISOR
      ? { numeroDocumento: identificador }
      : { OR: [{ numeroDocumento: identificador }, { correo: { equals: identificador, mode: 'insensitive' } }] },
    select: { ...usuarioSesionSelect, passwordHash: true },
  });
}

export function touchLastAccess(id: string) {
  return prisma.usuario.update({ where: { id }, data: { ultimoAcceso: new Date() }, select: { id: true } });
}

// Bloquea las filas de administradores activos para evaluar "último administrador" sin carreras.
export async function lockActiveAdmins(db: Db): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id::text AS id FROM induccion.usuarios
    WHERE lower(rol) IN (${Prisma.join([...ADMIN_ROLE_ALIASES])}) AND estado = ${UserStatus.ACTIVE}
    FOR UPDATE`;
  return rows.map((row) => row.id);
}

export async function lockUser(db: Db, id: string): Promise<void> {
  await db.$queryRaw`SELECT id FROM induccion.usuarios WHERE id = ${id}::uuid FOR UPDATE`;
}

export type UserListFilters = {
  search?: string;
  role?: string;
  status?: string;
  moduleId?: string;
  progressStatus?: string;
  lastActivityFrom?: Date;
  lastActivityTo?: Date;
};

function listWhere(filters: UserListFilters): Prisma.UsuarioWhereInput {
  const and: Prisma.UsuarioWhereInput[] = [];
  if (filters.search) {
    and.push({ OR: [
      { nombreCompleto: { contains: filters.search, mode: 'insensitive' } },
      { numeroDocumento: { contains: filters.search } },
    ] });
  }
  if (filters.role) and.push(filters.role === Role.ADMIN ? { rol: { in: [...ADMIN_ROLE_ALIASES] } } : { rol: filters.role });
  if (filters.status) and.push({ estado: filters.status });
  if (filters.moduleId || filters.progressStatus || filters.lastActivityFrom || filters.lastActivityTo) {
    and.push({ progresoModulos: { some: {
      ...(filters.moduleId ? { moduleId: filters.moduleId } : {}),
      ...(filters.progressStatus ? { status: filters.progressStatus as Prisma.EnumProgressStatusFilter['equals'] } : {}),
      ...(filters.lastActivityFrom || filters.lastActivityTo ? { lastActivityAt: {
        ...(filters.lastActivityFrom ? { gte: filters.lastActivityFrom } : {}),
        ...(filters.lastActivityTo ? { lt: filters.lastActivityTo } : {}),
      } } : {}),
    } } });
  }
  return and.length ? { AND: and } : {};
}

// Paginación por cursor con orden estable (fechaCreacion desc, id desc).
export function listUsers(filters: UserListFilters, cursor: Cursor | null, limit: number) {
  const where = listWhere(filters);
  const page: Prisma.UsuarioWhereInput = cursor
    ? { OR: [{ fechaCreacion: { lt: cursor.at } }, { fechaCreacion: cursor.at, id: { lt: cursor.id } }] }
    : {};
  return prisma.usuario.findMany({
    where: { AND: [where, page] },
    select: usuarioPublicoSelect,
    orderBy: [{ fechaCreacion: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });
}

export function countUsers(filters: UserListFilters) {
  return prisma.usuario.count({ where: listWhere(filters) });
}

// Paginación por desplazamiento solo para la ruta antigua /api/admin/asesores.
export function listUsersByOffset(filters: UserListFilters, skip: number, take: number) {
  return prisma.usuario.findMany({ where: listWhere(filters), select: usuarioPublicoSelect, orderBy: [{ fechaCreacion: 'desc' }, { id: 'desc' }], skip, take });
}
