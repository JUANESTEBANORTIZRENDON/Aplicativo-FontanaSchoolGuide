import { databaseModel } from './database.model.js';

export const usuarios = databaseModel.client.usuario;

export const usuarioPublico = {
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
} as const;

export function esAdministrador(rol: string): boolean {
  return ['administrador', 'admin', 'administrator'].includes(rol.toLowerCase());
}

export function rutaUsuario(usuario: {
  rol: string;
  debeCompletarDatos: boolean;
  debeCambiarPassword: boolean;
  tieneExperienciaCobranzasDigitales: boolean | null;
}): string {
  if (esAdministrador(usuario.rol)) return '/admin';
  if (usuario.debeCompletarDatos || usuario.tieneExperienciaCobranzasDigitales === null) return '/llena-tus-datos';
  if (usuario.debeCambiarPassword) return '/cambiar-contrasena';
  return usuario.tieneExperienciaCobranzasDigitales ? '/induccion/con-experiencia' : '/induccion/sin-experiencia';
}
