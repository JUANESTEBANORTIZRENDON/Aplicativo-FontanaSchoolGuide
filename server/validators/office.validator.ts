import { z } from 'zod';
import { OFFICE_CONFIG_LIMITS, TYPING_MAX_TYPED_LENGTH, type OfficeConfigValues } from '../domain/office.js';
import { reason, uuid } from './common.js';

export const attemptParams = z.object({ id: uuid });
export const activityParams = z.object({ id: uuid });
export const sectionParams = z.object({ sectionKey: z.string().regex(/^[a-z0-9-]{1,60}$/, 'Sección inválida.') });
export const keyParams = z.object({ key: z.string().regex(/^[A-Za-z0-9._-]{1,120}$/, 'Clave inválida.') });

// ---- Asesor ----
export const typingCompleteBody = z.object({
  nonce: z.string().min(20).max(100),
  typedText: z.string().max(TYPING_MAX_TYPED_LENGTH + 500),
  clientDurationSeconds: z.number().min(0).max(3600).optional(),
}).strict();
export type TypingCompleteBody = z.infer<typeof typingCompleteBody>;

// Un paso de la práctica de Excel: texto, número o un objeto corto de campos (agregar una fila, un acuerdo).
const stepValue = z.union([
  z.string().max(600),
  z.number().finite(),
  z.record(z.string().max(40), z.union([z.string().max(300), z.number().finite()])).refine((value) => Object.keys(value).length <= 8, 'Demasiados campos.'),
]);
export const excelSubmitBody = z.object({
  attemptId: uuid,
  steps: z.array(z.object({ questionId: z.string().regex(/^[a-z]+\.[a-z]+$/, 'Paso inválido.').max(60), value: stepValue }).strict()).max(20),
}).strict();
export type ExcelSubmitBody = z.infer<typeof excelSubmitBody>;

export const dictationQuery = z.object({ attemptId: uuid });
export const dictationSubmitBody = z.object({ attemptId: uuid, typedText: z.string().max(2000) }).strict();
export type DictationSubmitBody = z.infer<typeof dictationSubmitBody>;
export const dictationPlayBody = z.object({ attemptId: uuid }).strict();

// ---- Administrador ----
const limitedNumber = (key: keyof OfficeConfigValues) => {
  const limit = OFFICE_CONFIG_LIMITS[key];
  const base = limit.integer ? z.number().int() : z.number();
  return base.min(limit.min).max(limit.max);
};

// Los valores llegan numéricos (no cadenas). Al menos uno y un motivo obligatorio.
export const officeConfigBody = z.object({
  typingDurationSeconds: limitedNumber('typingDurationSeconds').optional(),
  typingMinCorrectCpm: limitedNumber('typingMinCorrectCpm').optional(),
  typingMinAccuracy: limitedNumber('typingMinAccuracy').optional(),
  typingMaxAttempts: limitedNumber('typingMaxAttempts').optional(),
  typingStartWindowSeconds: limitedNumber('typingStartWindowSeconds').optional(),
  typingAttemptTtlMinutes: limitedNumber('typingAttemptTtlMinutes').optional(),
  excelMinScore: limitedNumber('excelMinScore').optional(),
  excelMaxAttempts: limitedNumber('excelMaxAttempts').optional(),
  dictationMinScore: limitedNumber('dictationMinScore').optional(),
  dictationMaxAttempts: limitedNumber('dictationMaxAttempts').optional(),
  dictationMaxPlays: limitedNumber('dictationMaxPlays').optional(),
  reason: reason(5),
}).strict().refine((value) => Object.keys(value).some((key) => key !== 'reason'), { message: 'Indica al menos un valor para cambiar.' });
export type OfficeConfigBody = z.infer<typeof officeConfigBody>;

const statusEnum = z.enum(['ACTIVE', 'INACTIVE', 'DRAFT']);

export const typingTextBody = z.object({
  key: z.string().regex(/^[a-z0-9-]{3,60}$/, 'Usa minúsculas, números y guiones.'),
  title: z.string().trim().min(3).max(150),
  content: z.string().min(650, 'El texto debe tener al menos 650 caracteres.').max(900, 'El texto admite hasta 900 caracteres.'),
  status: statusEnum.default('DRAFT'),
  reason: reason(5),
}).strict();
export type TypingTextBody = z.infer<typeof typingTextBody>;
export const typingTextPatch = z.object({
  title: z.string().trim().min(3).max(150).optional(),
  content: z.string().min(650).max(900).optional(),
  status: statusEnum.optional(),
  reason: reason(5),
}).strict();
export type TypingTextPatch = z.infer<typeof typingTextPatch>;

export const dictationBody = z.object({
  key: z.string().regex(/^[a-z0-9-]{3,60}$/, 'Usa minúsculas, números y guiones.'),
  title: z.string().trim().min(3).max(150),
  expectedText: z.string().trim().min(20).max(800),
  difficulty: z.number().int().min(1).max(3).default(1),
  criticalRuleKeys: z.array(z.string().max(60)).max(20).default([]),
  audioKey: z.string().regex(/^[A-Za-z0-9._-]{1,120}$/).optional(),
  audioDurationSeconds: z.number().int().min(20).max(30).optional(),
  status: statusEnum.default('DRAFT'),
  reason: reason(5),
}).strict();
export type DictationBody = z.infer<typeof dictationBody>;
export const dictationPatch = z.object({
  title: z.string().trim().min(3).max(150).optional(),
  expectedText: z.string().trim().min(20).max(800).optional(),
  difficulty: z.number().int().min(1).max(3).optional(),
  criticalRuleKeys: z.array(z.string().max(60)).max(20).optional(),
  audioKey: z.string().regex(/^[A-Za-z0-9._-]{1,120}$/).nullable().optional(),
  audioDurationSeconds: z.number().int().min(20).max(30).nullable().optional(),
  status: statusEnum.optional(),
  reason: reason(5),
}).strict();
export type DictationPatch = z.infer<typeof dictationPatch>;

export const excelActivityBody = z.object({
  key: z.string().regex(/^[a-z0-9-]{3,60}$/, 'Usa minúsculas, números y guiones.'),
  title: z.string().trim().min(3).max(150),
  scenarioData: z.record(z.string(), z.unknown()),
  answerKey: z.record(z.string(), z.unknown()),
  status: statusEnum.default('DRAFT'),
  reason: reason(5),
}).strict();
export type ExcelActivityBody = z.infer<typeof excelActivityBody>;
export const excelActivityPatch = z.object({
  title: z.string().trim().min(3).max(150).optional(),
  scenarioData: z.record(z.string(), z.unknown()).optional(),
  answerKey: z.record(z.string(), z.unknown()).optional(),
  status: statusEnum.optional(),
  reason: reason(5),
}).strict();
export type ExcelActivityPatch = z.infer<typeof excelActivityPatch>;

const pairs = z.array(z.tuple([z.string().trim().min(1).max(60), z.string().trim().min(1).max(60)])).max(20);
export const spellingRuleBody = z.object({
  key: z.string().regex(/^[a-z0-9-]{3,60}$/, 'Usa minúsculas, números y guiones.'),
  category: z.enum(['HOMOFONA', 'TILDE_DIACRITICA', 'FORMA_VERBAL', 'PUNTUACION', 'MAYUSCULA']),
  severity: z.enum(['CRITICAL', 'MINOR']),
  weight: z.number().min(0).max(50),
  pairs,
  explanation: z.string().trim().min(10).max(400),
  examples: z.array(z.object({ incorrect: z.string().max(200), correct: z.string().max(200) }).strict()).max(10).default([]),
  status: statusEnum.default('DRAFT'),
  reason: reason(5),
}).strict();
export type SpellingRuleBody = z.infer<typeof spellingRuleBody>;
export const spellingRulePatch = z.object({
  category: z.enum(['HOMOFONA', 'TILDE_DIACRITICA', 'FORMA_VERBAL', 'PUNTUACION', 'MAYUSCULA']).optional(),
  severity: z.enum(['CRITICAL', 'MINOR']).optional(),
  weight: z.number().min(0).max(50).optional(),
  pairs: pairs.optional(),
  explanation: z.string().trim().min(10).max(400).optional(),
  examples: z.array(z.object({ incorrect: z.string().max(200), correct: z.string().max(200) }).strict()).max(10).optional(),
  status: statusEnum.optional(),
  reason: reason(5),
}).strict();
export type SpellingRulePatch = z.infer<typeof spellingRulePatch>;

export const mediaReasonQuery = z.object({ reason: reason(5).optional() });
