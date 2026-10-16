import { z } from 'zod';
import { email, trimmed } from './common.js';
import { BANCOS, SEXOS, TALLAS_CAMISA, TIPOS_DOCUMENTO, TIPOS_SANGRE } from '../domain/profile.js';

// Contrato existente de POST /api/auth/login: no cambia.
export const loginBody = z.object({
  identificador: z.string().trim().min(1).max(150),
  password: z.string().min(1).max(200),
  tipo: z.enum(['asesor', 'administrador']),
});
export type LoginBody = z.infer<typeof loginBody>;

export const completarDatosBody = z.object({
  nombre: trimmed(75, 'El nombre'),
  apellidos: trimmed(75, 'Los apellidos'),
  tipoDocumento: z.enum(TIPOS_DOCUMENTO),
  numeroDocumento: trimmed(30, 'El número de documento').regex(/^\d+$/, 'El documento debe contener solo números.'),
  fechaNacimiento: z.iso.date('Ingresa una fecha de nacimiento válida.').refine((value) => value <= new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), 'La fecha de nacimiento no puede estar en el futuro.'),
  sexo: z.enum(SEXOS),
  tipoSangre: z.enum(TIPOS_SANGRE),
  tallaCamisa: z.enum(TALLAS_CAMISA),
  direccionResidencia: trimmed(250, 'La dirección de residencia'),
  nombreContactoEmergencia: trimmed(150, 'El nombre del contacto de emergencia'),
  numeroContactoEmergencia: trimmed(30, 'El número del contacto de emergencia').regex(/^\+?[\d\s()-]{7,30}$/, 'Ingresa un teléfono de emergencia válido.'),
  banco: z.enum(BANCOS),
  otroBanco: z.string().trim().max(100).optional().default(''),
  numeroCuenta: trimmed(30, 'El número de cuenta').regex(/^\d+$/, 'La cuenta debe contener solo números.'),
  correo: email,
  telefono: z.string().trim().max(30, 'El teléfono debe tener como máximo 30 caracteres.').optional().default(''),
}).superRefine((value, context) => {
  if (`${value.nombre} ${value.apellidos}`.length > 150) {
    context.addIssue({ code: 'custom', path: ['apellidos'], message: 'El nombre completo admite como máximo 150 caracteres.' });
  }
  if (value.banco === 'Otros' && !value.otroBanco) {
    context.addIssue({ code: 'custom', path: ['otroBanco'], message: 'Especifica el nombre del banco.' });
  }
});
export type CompletarDatosBody = z.infer<typeof completarDatosBody>;

export const experienciaBody = z.object({
  tieneExperienciaCobranzasDigitales: z.boolean({ message: 'Selecciona si tienes experiencia en cobranzas digitales.' }),
}).strict();
export type ExperienciaBody = z.infer<typeof experienciaBody>;

export const avanceInduccionBody = z.object({
  paso: z.enum(['historia', 'metodo'], { message: 'Indica si completaste la historia o el método.' }),
});
export type AvanceInduccionBody = z.infer<typeof avanceInduccionBody>;
