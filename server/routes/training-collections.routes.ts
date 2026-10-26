import { Router } from 'express';
import { z } from 'zod';
import { COLLECTIONS_KEYS } from '../domain/collections.js';
import { Role } from '../domain/enums.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validBody, validParams, validate } from '../middleware/validate.js';
import { collectionsState, completeCollectionsBlock, submitCollectionsBlock, submitCollectionsExam, startCollectionsExam, saveCollectionsExamSection } from '../services/collections.service.js';
import { advisorCollectionsState, advisorDiagnosticResult } from '../domain/advisor-results.js';

const params = z.object({ key: z.enum(COLLECTIONS_KEYS) });
const body = z.object({ answers: z.record(z.string().max(40), z.string().max(50)).refine((value) => Object.keys(value).length <= 12) }).strict();
const examBody = z.object({ answers: z.record(z.string().min(1).max(40), z.string().max(1000)).refine((value) => Object.keys(value).length <= 24) }).strict();
export const collectionsRouter = Router();
collectionsRouter.use(requireAuth, requireRole(Role.ADVISOR));
collectionsRouter.get('/module', async (request, response) => {
  response.json({ data: advisorCollectionsState(await collectionsState(request.usuario!.id)) });
});
collectionsRouter.post('/blocks/:key/complete', validate({ params, body: z.object({}).strict() }), async (request, response) => {
  response.json({ data: advisorCollectionsState(await completeCollectionsBlock(request.usuario!.id, validParams<z.infer<typeof params>>(request).key)) });
});
collectionsRouter.post('/exam/start', validate({ body: z.object({}).strict() }), async (request, response) => {
  response.json({ data: await startCollectionsExam(request.usuario!.id) });
});
collectionsRouter.post('/exam/sections/:section', validate({ params: z.object({ section: z.string().min(1).max(40) }), body: examBody }), async (request, response) => {
  response.json({ data: await saveCollectionsExamSection(request.usuario!.id, validParams<{ section: string }>(request).section, validBody<z.infer<typeof examBody>>(request).answers) });
});
collectionsRouter.post('/exam', validate({ body: examBody }), async (request, response) => {
  const data = await submitCollectionsExam(request.usuario!.id, validBody<z.infer<typeof examBody>>(request).answers);
  response.json({ data: { result: advisorDiagnosticResult(data.result), state: advisorCollectionsState(data.state) } });
});
collectionsRouter.post('/blocks/:key/questions/:question', validate({
  params: params.extend({ question: z.string().min(1).max(40) }),
  body: z.object({ answer: z.string().min(1).max(50) }).strict(),
}), async (request, response) => {
  const { key, question } = validParams<{ key: typeof COLLECTIONS_KEYS[number]; question: string }>(request);
  const { answer } = validBody<{ answer: string }>(request);
  response.json({ data: await submitCollectionsBlock(request.usuario!.id, key, { [question]: answer }, question) });
});
collectionsRouter.post('/blocks/:key', validate({ params, body }), async (request, response) => {
  response.json({ data: await submitCollectionsBlock(request.usuario!.id, validParams<z.infer<typeof params>>(request).key, validBody<z.infer<typeof body>>(request).answers) });
});
