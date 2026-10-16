import { z } from 'zod';
import { OVERRIDE_REASON_MIN } from '../config/security.js';
import { UserStatus } from '../domain/enums.js';
import { dateParam, pagination, reason, uuid } from './common.js';

export const catalogStatusBody = z.object({ status: z.enum(['ACTIVE', 'INACTIVE']), reason: reason() }).strict();
export type CatalogStatusBody = z.infer<typeof catalogStatusBody>;

export const evaluationBody = z.object({
  minimumScore: z.coerce.number().min(0).max(100),
  maxAttempts: z.coerce.number().int().min(1).max(20),
  waitMinutes: z.coerce.number().int().min(0).max(10_080).default(0),
  title: z.string().trim().max(150).optional(),
  reason: reason().optional(),
}).strict();
export type EvaluationBody = z.infer<typeof evaluationBody>;

export const reactivateParams = z.object({ userId: uuid, activityId: uuid });

export const reactivateBody = z.object({
  action: z.enum(['REACTIVATE', 'UNLOCK', 'EXTRA_ATTEMPT', 'RESET_WAIT', 'REOPEN_MODULE']),
  reason: reason(OVERRIDE_REASON_MIN),
  extraAttempts: z.coerce.number().int().min(1).max(10).optional(),
  expiresAt: z.iso.datetime({ offset: true, message: 'Usa una fecha ISO 8601 con zona horaria.' }).transform((value) => new Date(value)).optional(),
}).strict();
export type ReactivateBody = z.infer<typeof reactivateBody>;

// Cupo de intentos de un asesor en una actividad. null restablece el valor de la evaluación.
export const attemptLimitParams = z.object({ userId: uuid, activityId: uuid });
export const attemptLimitBody = z.object({
  maxAttempts: z.coerce.number().int().min(1).max(50).nullable(),
  reason: reason(OVERRIDE_REASON_MIN),
}).strict();
export type AttemptLimitBody = z.infer<typeof attemptLimitBody>;

export const idempotencyKey = z.uuid({ message: 'El encabezado Idempotency-Key debe ser un UUID.' });

export const reasonBody = z.object({ reason: reason() }).strict();
export type ReasonBody = z.infer<typeof reasonBody>;

export const metricsQuery = z.object({
  from: dateParam.optional(),
  to: dateParam.optional(),
  advisorStatus: z.enum([UserStatus.ACTIVE, UserStatus.INACTIVE, UserStatus.LOCKED]).optional(),
  moduleId: uuid.optional(),
  activityId: uuid.optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
  ...pagination,
});

export const moduleMetricsParams = z.object({ moduleId: uuid });

export const auditQuery = z.object({
  actorUserId: uuid.optional(),
  entityType: z.string().trim().max(60).optional(),
  entityId: z.string().trim().max(100).optional(),
  action: z.string().trim().max(80).optional(),
  from: dateParam.optional(),
  to: dateParam.optional(),
  ...pagination,
});
export type AuditQuery = z.infer<typeof auditQuery>;
