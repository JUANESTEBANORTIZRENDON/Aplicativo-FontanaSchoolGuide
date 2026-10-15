import { z } from 'zod';
import { Role, UserStatus } from '../domain/enums.js';
import { dateParam, email, pagination, password, reason, trimmed, uuid } from './common.js';

const rol = z.enum([Role.ADMIN, Role.ADVISOR]);
const estado = z.enum([UserStatus.ACTIVE, UserStatus.INACTIVE, UserStatus.LOCKED]);
const documento = trimmed(30, 'El número de documento').regex(/^[A-Za-z0-9-]+$/, 'El documento solo admite letras, números y guiones.');
const telefono = z.string().trim().max(30, 'El teléfono debe tener como máximo 30 caracteres.');

// .strict(): passwordHash, versionSesion, creadoPor o fechas en el cuerpo se rechazan.
export const createUserBody = z.object({
  nombreCompleto: trimmed(150, 'El nombre completo'),
  numeroDocumento: documento,
  tipoDocumento: trimmed(10, 'El tipo de documento').optional(),
  correo: email.optional(),
  telefono: telefono.optional(),
  rol: rol.default(Role.ADVISOR),
  password,
}).strict();
export type CreateUserBody = z.infer<typeof createUserBody>;

export const updateUserBody = z.object({
  nombreCompleto: trimmed(150, 'El nombre completo').optional(),
  numeroDocumento: documento.optional(),
  tipoDocumento: trimmed(10, 'El tipo de documento').optional(),
  correo: email.nullable().optional(),
  telefono: telefono.nullable().optional(),
  rol: rol.optional(),
  reason: reason().optional(),
}).strict().refine((value) => Object.keys(value).some((key) => key !== 'reason'), 'Envía al menos un campo para actualizar.');
export type UpdateUserBody = z.infer<typeof updateUserBody>;

export const changeStatusBody = z.object({ estado, reason: reason() }).strict();
export type ChangeStatusBody = z.infer<typeof changeStatusBody>;

export const resetPasswordBody = z.object({ reason: reason().optional() }).strict();
export type ResetPasswordBody = z.infer<typeof resetPasswordBody>;

export const listUsersQuery = z.object({
  search: z.string().trim().max(80).optional(),
  role: rol.optional(),
  status: estado.optional(),
  moduleId: uuid.optional(),
  progressStatus: z.enum(['NOT_STARTED', 'AVAILABLE', 'IN_PROGRESS', 'PASSED', 'FAILED', 'BLOCKED']).optional(),
  lastActivityFrom: dateParam.optional(),
  lastActivityTo: dateParam.optional(),
  ...pagination,
});
export type ListUsersQuery = z.infer<typeof listUsersQuery>;

// Ruta antigua /api/admin/asesores (alias).
export const legacyListQuery = z.object({
  buscar: z.string().trim().max(80).optional(),
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
});
export const legacyCreateBody = z.object({
  nombreCompleto: trimmed(150, 'El nombre completo'),
  numeroDocumento: documento,
  password,
}).strict();
export const legacyUpdateBody = z.object({
  nombreCompleto: trimmed(150, 'El nombre completo'),
  numeroDocumento: documento,
  estado: z.enum([UserStatus.ACTIVE, UserStatus.INACTIVE]),
}).strict();
