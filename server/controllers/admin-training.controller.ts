import type { Request, Response } from 'express';
import { validBody, validParams, validQuery } from '../middleware/validate.js';
import { listAuditPage } from '../services/audit.service.js';
import { getAdvisorFile } from '../services/advisor-file.service.js';
import * as attemptLimitService from '../services/attempt-limit.service.js';
import * as catalogService from '../services/catalog.service.js';
import * as certificateService from '../services/certificate.service.js';
import * as metricsService from '../services/metrics.service.js';
import * as overrideService from '../services/override.service.js';
import { idempotencyKey, type AttemptLimitBody, type AuditQuery, type CatalogStatusBody, type EvaluationBody, type ReactivateBody, type ReasonBody } from '../validators/admin.validator.js';
import { actionContext } from './admin-users.controller.js';

export async function advisorProgress(request: Request, response: Response): Promise<void> {
  const { id } = validParams<{ id: string }>(request);
  response.json({ data: await getAdvisorFile(id) });
}

export async function listModules(_request: Request, response: Response): Promise<void> {
  response.json({ data: await catalogService.listModules() });
}

export async function setModuleStatus(request: Request, response: Response): Promise<void> {
  const { id } = validParams<{ id: string }>(request);
  const body = validBody<CatalogStatusBody>(request);
  response.json({ data: await catalogService.setModuleStatus(id, body.status, body.reason, actionContext(request)) });
}

export async function setActivityStatus(request: Request, response: Response): Promise<void> {
  const { id } = validParams<{ id: string }>(request);
  const body = validBody<CatalogStatusBody>(request);
  response.json({ data: await catalogService.setActivityStatus(id, body.status, body.reason, actionContext(request)) });
}

export async function createEvaluation(request: Request, response: Response): Promise<void> {
  const { id } = validParams<{ id: string }>(request);
  response.status(201).json({ data: await catalogService.createEvaluationVersion(id, validBody<EvaluationBody>(request), actionContext(request)) });
}

export async function reactivate(request: Request, response: Response): Promise<void> {
  const { userId, activityId } = validParams<{ userId: string; activityId: string }>(request);
  const key = idempotencyKey.parse(request.get('idempotency-key'));
  const result = await overrideService.reactivate(userId, activityId, validBody<ReactivateBody>(request), key, actionContext(request));
  response.status(result.created ? 201 : 200).json({ data: result.override, meta: { created: result.created } });
}

export async function setAttemptLimit(request: Request, response: Response): Promise<void> {
  const { userId, activityId } = validParams<{ userId: string; activityId: string }>(request);
  const body = validBody<AttemptLimitBody>(request);
  response.json({ data: await attemptLimitService.setAttemptLimit(userId, activityId, body.maxAttempts, body.reason, actionContext(request)) });
}

export async function revokeOverride(request: Request, response: Response): Promise<void> {
  const { id } = validParams<{ id: string }>(request);
  response.json({ data: await overrideService.revoke(id, validBody<ReasonBody>(request).reason, actionContext(request)) });
}

export async function revokeCertificate(request: Request, response: Response): Promise<void> {
  const { id } = validParams<{ id: string }>(request);
  response.json({ data: await certificateService.revoke(id, validBody<ReasonBody>(request).reason, actionContext(request)) });
}

export async function reissueCertificate(request: Request, response: Response): Promise<void> {
  const { id } = validParams<{ id: string }>(request);
  response.status(201).json({ data: await certificateService.reissue(id, validBody<ReasonBody>(request).reason, actionContext(request)) });
}

export async function metricsSummary(request: Request, response: Response): Promise<void> {
  const query = validQuery<metricsService.MetricsQuery>(request);
  response.json({ data: await metricsService.summary(query), meta: { filters: query } });
}

export async function metricsLocation(request: Request, response: Response): Promise<void> {
  const page = await metricsService.locationPage(validQuery<metricsService.MetricsQuery>(request));
  response.json({ data: page.items, meta: { nextCursor: page.nextCursor } });
}

export async function moduleMetrics(request: Request, response: Response): Promise<void> {
  const { moduleId } = validParams<{ moduleId: string }>(request);
  response.json({ data: await metricsService.moduleDetail(moduleId, validQuery<metricsService.MetricsQuery>(request)) });
}

// Solo lectura: ninguna ruta edita ni borra la auditoría.
export async function audit(request: Request, response: Response): Promise<void> {
  const page = await listAuditPage(validQuery<AuditQuery>(request));
  response.json({ data: page.items, meta: { nextCursor: page.nextCursor } });
}
