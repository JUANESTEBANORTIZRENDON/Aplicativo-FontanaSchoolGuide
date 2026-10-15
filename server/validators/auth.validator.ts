import { z } from 'zod';
import { email } from './common.js';

// Contrato existente de POST /api/auth/login: no cambia.
export const loginBody = z.object({
  identificador: z.string().trim().min(1).max(150),
  password: z.string().min(1).max(200),
  tipo: z.enum(['asesor', 'administrador']),
});
export type LoginBody = z.infer<typeof loginBody>;

export const completarDatosBody = z.object({
  correo: email,
  telefono: z.string().trim().max(30, 'El teléfono debe tener como máximo 30 caracteres.').optional().default(''),
});
export type CompletarDatosBody = z.infer<typeof completarDatosBody>;

export const experienciaBody = z.object({
  tieneExperienciaCobranzasDigitales: z.boolean({ message: 'Selecciona si tienes experiencia en cobranzas digitales.' }),
}).strict();
export type ExperienciaBody = z.infer<typeof experienciaBody>;
