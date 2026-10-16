import { esAdministrador } from './enums.js';
import type { DatosPersonales } from './profile.js';

// Usuario autenticado tal como lo carga requireAuth: nunca incluye passwordHash.
export type AuthUser = Partial<DatosPersonales> & {
  id: string;
  nombreCompleto: string;
  tipoDocumento: string;
  numeroDocumento: string;
  correo: string | null;
  telefono: string | null;
  rol: string;
  estado: string;
  debeCompletarDatos: boolean;
  debeCambiarPassword: boolean;
  tieneExperienciaCobranzasDigitales: boolean | null;
  fechaInduccionCompletada: Date | null;
  fechaHistoriaCompletada: Date | null;
  fechaMetodoCompletado: Date | null;
  versionSesion: number;
};

// Al terminar la inducción inicial, el asesor llega a su ruta de formación. La experiencia en cobranzas se
// responde dentro del módulo 02; quien ya la había respondido conserva su ruta.
export function rutaUsuario(usuario: { rol: string; debeCompletarDatos: boolean; tieneExperienciaCobranzasDigitales: boolean | null; fechaInduccionCompletada: Date | null }): string {
  if (esAdministrador(usuario.rol)) return '/admin';
  if (usuario.debeCompletarDatos) return '/llena-tus-datos';
  if (usuario.tieneExperienciaCobranzasDigitales !== null) {
    return usuario.tieneExperienciaCobranzasDigitales ? '/practica/experiencia' : '/practica/nuevo';
  }
  return usuario.fechaInduccionCompletada ? '/practica' : '/induccion';
}

export function permisosUsuario(usuario: { rol: string }): string[] {
  return esAdministrador(usuario.rol)
    ? ['admin:usuarios', 'admin:catalogo', 'admin:excepciones', 'admin:certificados', 'admin:metricas', 'admin:auditoria']
    : ['asesor:formacion'];
}

// Datos que el servidor devuelve del usuario autenticado (contrato de /api/auth/*).
export function serializarUsuario(usuario: AuthUser) {
  return {
    id: usuario.id,
    nombreCompleto: usuario.nombreCompleto,
    numeroDocumento: usuario.numeroDocumento,
    tipoDocumento: usuario.tipoDocumento,
    correo: usuario.correo,
    telefono: usuario.telefono,
    nombre: usuario.nombre ?? null,
    apellidos: usuario.apellidos ?? null,
    fechaNacimiento: usuario.fechaNacimiento?.toISOString().slice(0, 10) ?? null,
    sexo: usuario.sexo ?? null,
    tipoSangre: usuario.tipoSangre ?? null,
    tallaCamisa: usuario.tallaCamisa ?? null,
    direccionResidencia: usuario.direccionResidencia ?? null,
    nombreContactoEmergencia: usuario.nombreContactoEmergencia ?? null,
    numeroContactoEmergencia: usuario.numeroContactoEmergencia ?? null,
    banco: usuario.banco ?? null,
    otroBanco: usuario.otroBanco ?? null,
    numeroCuenta: usuario.numeroCuenta ?? null,
    rol: usuario.rol,
    estado: usuario.estado,
    debeCompletarDatos: usuario.debeCompletarDatos,
    debeCambiarPassword: usuario.debeCambiarPassword,
    tieneExperienciaCobranzasDigitales: usuario.tieneExperienciaCobranzasDigitales,
    // Avance en "Conoce la empresa": lo ya completado no vuelve a bloquearse.
    historiaCompletada: usuario.fechaHistoriaCompletada !== null,
    metodoCompletado: usuario.fechaMetodoCompletado !== null,
    ruta: rutaUsuario(usuario),
  };
}

// Campos que nunca se guardan en auditoría.
const CAMPOS_SENSIBLES = new Set(['passwordHash', 'versionSesion']);

export function sinCamposSensibles<T extends Record<string, unknown>>(value: T | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !CAMPOS_SENSIBLES.has(key)));
}
