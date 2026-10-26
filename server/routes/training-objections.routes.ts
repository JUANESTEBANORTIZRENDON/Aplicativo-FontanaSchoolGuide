import { Router } from 'express';
import { z } from 'zod';
import { OBJECTIONS_KEYS } from '../domain/objections.js';
import { Role } from '../domain/enums.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validBody, validParams, validate } from '../middleware/validate.js';
import { completeObjectionsBlock, objectionsState, practiceObjection, saveObjectionsAnswer, startObjectionsExam, submitObjectionsExam } from '../services/objections.service.js';
import { OBJECTIONS_CASE_KEYS, OBJECTIONS_MAX_TEXT } from '../domain/objections-expert.js';
import { advisorObjectionsResult, advisorObjectionsState } from '../domain/advisor-results.js';

const params = z.object({ key: z.enum(OBJECTIONS_KEYS) });
export const objectionsRouter = Router();
objectionsRouter.use(requireAuth, requireRole(Role.ADVISOR));
objectionsRouter.get('/module', async (request, response) => {
  response.json({ data: advisorObjectionsState(await objectionsState(request.usuario!.id)) });
});
objectionsRouter.post('/blocks/:key/complete', validate({ params, body: z.object({}).strict() }), async (request, response) => {
  response.json({ data: advisorObjectionsState(await completeObjectionsBlock(request.usuario!.id, validParams<z.infer<typeof params>>(request).key)) });
});
objectionsRouter.post('/exam/start', validate({ body: z.object({}).strict() }), async (request, response) => {
  response.json({ data: advisorObjectionsState(await startObjectionsExam(request.usuario!.id)) });
});
const answerBody = z.object({ attemptId: z.uuid(), key: z.enum(OBJECTIONS_CASE_KEYS), text: z.string().max(OBJECTIONS_MAX_TEXT) }).strict();
objectionsRouter.put('/exam/answer', validate({ body: answerBody }), async (request, response) => {
  const body = validBody<z.infer<typeof answerBody>>(request);
  response.json({ data: await saveObjectionsAnswer(request.usuario!.id, body.attemptId, body.key, body.text) });
});
const submitBody = z.object({ attemptId: z.uuid(), answers: z.partialRecord(z.enum(OBJECTIONS_CASE_KEYS), z.string().max(OBJECTIONS_MAX_TEXT)).optional() }).strict();
objectionsRouter.post('/exam/submit', validate({ body: submitBody }), async (request, response) => {
  const body = validBody<z.infer<typeof submitBody>>(request);
  const data = await submitObjectionsExam(request.usuario!.id, body.attemptId, undefined, body.answers);
  response.json({ data: { ...data, result: advisorObjectionsResult(data.result), ...('state' in data ? { state: advisorObjectionsState(data.state) } : {}) } });
});
const practiceBody = z.object({ key: z.enum(OBJECTIONS_CASE_KEYS), text: z.string().trim().min(1).max(OBJECTIONS_MAX_TEXT) }).strict();
objectionsRouter.post('/practice', validate({ body: practiceBody }), async (request, response) => {
  const body = validBody<z.infer<typeof practiceBody>>(request);
  response.json({ data: await practiceObjection(request.usuario!.id, body.key, body.text) });
});
