import 'dotenv/config';
import { z } from 'zod';

const booleanFlag = z.enum(['true', 'false', '1', '0']).default('false').transform((value) => value === 'true' || value === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria.'),
  DIRECT_URL: z.string().optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  SESSION_SECRET: z.string().optional(),
  APP_TIMEZONE: z.string().default('America/Bogota'),
  TYPING_WEBHOOK_SECRET: z.string().min(16).optional(),
  STALLED_DAYS: z.coerce.number().int().min(1).max(365).default(7),
  CERTIFICATES_ENABLED: booleanFlag,
}).superRefine((value, context) => {
  if (value.NODE_ENV === 'production' && (!value.SESSION_SECRET || value.SESSION_SECRET.length < 32)) {
    context.addIssue({ code: 'custom', path: ['SESSION_SECRET'], message: 'SESSION_SECRET debe tener al menos 32 caracteres en producción.' });
  }
  try {
    new Intl.DateTimeFormat('es-CO', { timeZone: value.APP_TIMEZONE });
  } catch {
    context.addIssue({ code: 'custom', path: ['APP_TIMEZONE'], message: 'APP_TIMEZONE no es una zona horaria válida.' });
  }
});

const parsed = schema.safeParse({
  ...process.env,
  TYPING_WEBHOOK_SECRET: process.env.TYPING_WEBHOOK_SECRET || undefined,
  SESSION_SECRET: process.env.SESSION_SECRET || undefined,
});

if (!parsed.success) {
  const detail = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Configuración inválida. ${detail}`);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
