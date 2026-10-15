import { z } from 'zod';
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH, STATUS_REASON_MIN } from '../config/security.js';

export const uuid = z.uuid({ message: 'Identificador inválido.' });

export const idParams = z.object({ id: uuid });

export const trimmed = (max: number, label = 'El campo') => z.string().trim().min(1, `${label} es obligatorio.`).max(max, `${label} admite como máximo ${max} caracteres.`);

export const password = z.string()
  .min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`)
  .refine((value) => Buffer.byteLength(value, 'utf8') <= PASSWORD_MAX_BYTES, `La contraseña admite hasta ${PASSWORD_MAX_BYTES} bytes.`);

export const reason = (min = STATUS_REASON_MIN) => z.string().trim()
  .min(min, `El motivo debe tener al menos ${min} caracteres.`)
  .max(500, 'El motivo admite como máximo 500 caracteres.');

export const email = z.string().trim().max(150).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Ingresa un correo válido con @ y dominio, por ejemplo nombre@empresa.com.');

// Fecha 'YYYY-MM-DD' o fecha-hora ISO; se interpreta en APP_TIMEZONE.
export const dateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/, 'Usa el formato AAAA-MM-DD.');

export const pagination = {
  cursor: z.string().max(300).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};
