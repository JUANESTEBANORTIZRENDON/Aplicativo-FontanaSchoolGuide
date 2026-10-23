import { Router } from 'express';
import { z } from 'zod';
import { Role } from '../domain/enums.js';
import { OPTION_LETTERS, type OptionLetter } from '../domain/final-exam.js';
import { TIPIFICA_EXERCISE_COUNT } from '../domain/tipifica/exercises.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validBody, validParams, validate } from '../middleware/validate.js';
import { finalExamState, saveFinalExamAnswer, startFinalExam, submitFinalExam } from '../services/final-exam.service.js';
import { myReactivationRequests, requestReactivation } from '../services/reactivation.service.js';
import { startTipificaExercise, submitTipificaExercise, tipificaState } from '../services/tipifica.service.js';
import { uuid } from '../validators/common.js';

// Evaluaciones oficiales del asesor: los seis ejercicios de Tipifica, el examen general y las solicitudes de
// reactivación. La identidad sale de la sesión; ningún puntaje del navegador se acepta.

const exerciseParams = z.object({ number: z.coerce.number().int().min(1).max(TIPIFICA_EXERCISE_COUNT) });
const text = (max: number) => z.string().max(max).optional();
const typificationBody = z.object({
  action: text(40), contact: text(40), channel: text(40), profile: text(100), reason: text(100), phone: text(40),
  note: text(600), location: z.boolean().optional(), promiseDate: text(20), promiseAmount: text(20), callbackAt: text(30),
}).strict();

export const evaluationRouter = Router();
evaluationRouter.use(requireAuth, requireRole(Role.ADVISOR));

evaluationRouter.get('/tipifica', async (request, response) => {
  response.json({ data: await tipificaState(request.usuario!.id) });
});
evaluationRouter.post('/tipifica/exercises/:number/start', validate({ params: exerciseParams, body: z.object({}).strict() }), async (request, response) => {
  response.json({ data: await startTipificaExercise(request.usuario!.id, validParams<z.infer<typeof exerciseParams>>(request).number) });
});
evaluationRouter.post('/tipifica/exercises/:number/submit', validate({ params: exerciseParams, body: typificationBody }), async (request, response) => {
  const { number } = validParams<z.infer<typeof exerciseParams>>(request);
  response.json({ data: await submitTipificaExercise(request.usuario!.id, number, validBody<z.infer<typeof typificationBody>>(request)) });
});

evaluationRouter.get('/final-exam', async (request, response) => {
  response.json({ data: await finalExamState(request.usuario!.id) });
});
evaluationRouter.post('/final-exam/start', validate({ body: z.object({}).strict() }), async (request, response) => {
  response.json({ data: await startFinalExam(request.usuario!.id) });
});
const answerBody = z.object({ questionId: z.string().min(1).max(100), option: z.enum(OPTION_LETTERS) }).strict();
evaluationRouter.put('/final-exam/answers', validate({ body: answerBody }), async (request, response) => {
  const body = validBody<{ questionId: string; option: OptionLetter }>(request);
  response.json({ data: await saveFinalExamAnswer(request.usuario!.id, body.questionId, body.option) });
});
evaluationRouter.post('/final-exam/submit', validate({ body: z.object({}).strict() }), async (request, response) => {
  response.json({ data: await submitFinalExam(request.usuario!.id) });
});

evaluationRouter.get('/reactivation-requests', async (request, response) => {
  response.json({ data: await myReactivationRequests(request.usuario!.id) });
});
const requestBody = z.object({ activityId: uuid, note: z.string().trim().max(500).optional() }).strict();
evaluationRouter.post('/reactivation-requests', validate({ body: requestBody }), async (request, response) => {
  const body = validBody<z.infer<typeof requestBody>>(request);
  const { request: created, created: isNew } = await requestReactivation(request.usuario!.id, body.activityId, body.note ?? null);
  response.status(isNew ? 201 : 200).json({ data: created });
});
