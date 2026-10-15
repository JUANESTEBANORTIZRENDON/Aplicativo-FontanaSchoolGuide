// usuarios.rol y usuarios.estado siguen siendo varchar (protegidos por CHECK en la base).
// Estas constantes son la única fuente de sus valores dentro del código.

export const Role = {
  ADMIN: 'administrador',
  ADVISOR: 'asesor',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const UserStatus = {
  ACTIVE: 'activo',
  INACTIVE: 'inactivo',
  LOCKED: 'bloqueado',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const ROLES: readonly Role[] = [Role.ADMIN, Role.ADVISOR];
export const USER_STATUSES: readonly UserStatus[] = [UserStatus.ACTIVE, UserStatus.INACTIVE, UserStatus.LOCKED];

// Alias históricos de administrador aceptados al leer.
export const ADMIN_ROLE_ALIASES = ['administrador', 'admin', 'administrator'] as const;

export function esAdministrador(rol: string): boolean {
  return (ADMIN_ROLE_ALIASES as readonly string[]).includes(rol.toLowerCase());
}

export function esAsesor(rol: string): boolean {
  return rol.toLowerCase() === Role.ADVISOR;
}

// Slug del módulo final; su estado depende de los sellos, no de actividades.
export const CERTIFICATE_MODULE_SLUG = 'certificado';
