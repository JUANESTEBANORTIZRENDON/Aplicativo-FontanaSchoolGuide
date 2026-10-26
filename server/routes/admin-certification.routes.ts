import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { actionContext } from '../controllers/admin-users.controller.js';
import { TRAINING_NAME } from '../domain/certification.js';
import { FINAL_EXAM_LIMITS } from '../domain/final-exam.js';
import { validBody, validParams, validQuery, validate } from '../middleware/validate.js';
import {
  approveCertification, certificateForPdf, certificationDossier, listCertifications, listTrainingSummaries, returnCertification,
} from '../services/certification.service.js';
import { configureFinalExam, finalExamConfig } from '../services/final-exam.service.js';
import {
  approveReactivation, listReactivationRequests, reactivationArchive, reactivationRequestDetail, rejectReactivation,
} from '../services/reactivation.service.js';
import { certificatePdf } from '../utils/certificate-pdf.js';
import { idParams, reason, uuid } from '../validators/common.js';

// Validación y certificaciones (montado bajo /api/admin, que ya exige sesión de administrador).

export const adminCertificationRouter = Router();

const requestsQuery = z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(), userId: uuid.optional(), cursor: uuid.optional() }).strict();
adminCertificationRouter.get('/reactivation-requests', validate({ query: requestsQuery }), async (request, response) => {
  response.json({ data: await listReactivationRequests(validQuery<z.infer<typeof requestsQuery>>(request)) });
});
adminCertificationRouter.get('/reactivation-requests/:id', validate({ params: idParams }), async (request, response) => {
  response.json({ data: await reactivationRequestDetail(validParams<{ id: string }>(request).id) });
});
adminCertificationRouter.get('/reactivation-requests/:id/archive', validate({ params: idParams }), async (request, response) => {
  response.attachment('fontana-recorrido-anterior.json').json(await reactivationArchive(validParams<{ id: string }>(request).id));
});
const decisionBody = z.object({ reason: reason(5) }).strict();
adminCertificationRouter.post('/reactivation-requests/:id/approve', validate({ params: idParams, body: decisionBody }), async (request, response) => {
  response.json({ data: await approveReactivation(validParams<{ id: string }>(request).id, validBody<{ reason: string }>(request).reason, actionContext(request)) });
});
adminCertificationRouter.post('/reactivation-requests/:id/reject', validate({ params: idParams, body: decisionBody }), async (request, response) => {
  response.json({ data: await rejectReactivation(validParams<{ id: string }>(request).id, validBody<{ reason: string }>(request).reason, actionContext(request)) });
});

const certificationsQuery = z.object({ status: z.enum(['EN_FORMACION', 'PENDIENTE_VALIDACION', 'DEVUELTO', 'CERTIFICADO']).optional(), cursor: uuid.optional() }).strict();
adminCertificationRouter.get('/certifications', validate({ query: certificationsQuery }), async (request, response) => {
  response.json({ data: await listCertifications(validQuery<z.infer<typeof certificationsQuery>>(request)) });
});
const userParams = z.object({ userId: uuid });
adminCertificationRouter.get('/certifications/:userId', validate({ params: userParams }), async (request, response) => {
  response.json({ data: await certificationDossier(validParams<{ userId: string }>(request).userId) });
});
const approveBody = z.object({ reason: z.string().trim().max(500).optional() }).strict();
adminCertificationRouter.post('/certifications/:userId/approve', validate({ params: userParams, body: approveBody }), async (request, response) => {
  const result = await approveCertification(validParams<{ userId: string }>(request).userId, validBody<{ reason?: string }>(request).reason || null, actionContext(request));
  response.status(result.created ? 201 : 200).json({ data: result });
});
const returnBody = z.object({ reason: reason(5), activityIds: z.array(uuid).max(20).default([]) }).strict();
adminCertificationRouter.post('/certifications/:userId/return', validate({ params: userParams, body: returnBody }), async (request, response) => {
  const body = validBody<z.infer<typeof returnBody>>(request);
  response.status(201).json({ data: await returnCertification(validParams<{ userId: string }>(request).userId, body.reason, body.activityIds, actionContext(request)) });
});

adminCertificationRouter.get('/training-summaries', validate({ query: z.object({ cursor: uuid.optional() }).strict() }), async (request, response) => {
  response.json({ data: await listTrainingSummaries(validQuery<{ cursor?: string }>(request).cursor) });
});

adminCertificationRouter.get('/final-exam/config', async (_request, response) => {
  response.json({ data: await finalExamConfig() });
});
const configBody = z.object({
  questionCount: z.coerce.number().int().min(FINAL_EXAM_LIMITS.questionCount.min).max(FINAL_EXAM_LIMITS.questionCount.max),
  minimumScore: z.coerce.number().min(FINAL_EXAM_LIMITS.minimumScore.min).max(FINAL_EXAM_LIMITS.minimumScore.max),
  reason: reason(5),
}).strict();
adminCertificationRouter.put('/final-exam/config', validate({ body: configBody }), async (request, response) => {
  await configureFinalExam(validBody<z.infer<typeof configBody>>(request), actionContext(request));
  response.json({ data: await finalExamConfig() });
});

adminCertificationRouter.get('/certificates/:id/pdf', validate({ params: idParams }), async (request, response) => {
  const certificate = await certificateForPdf({ id: validParams<{ id: string }>(request).id });
  const verifyUrl = `${request.protocol}://${request.get('host')}/verificar/${certificate.code}`;
  const pdf = certificatePdf({ holder: certificate.user.nombreCompleto, trainingName: TRAINING_NAME, issuedAt: certificate.issuedAt, code: certificate.code, verifyUrl, timeZone: env.APP_TIMEZONE });
  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Disposition', `attachment; filename="certificado-${certificate.code}.pdf"`);
  response.send(pdf);
});
