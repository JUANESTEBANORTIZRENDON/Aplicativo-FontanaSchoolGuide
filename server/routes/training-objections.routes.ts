import { Router } from 'express';
import { z } from 'zod';
import { OBJECTIONS_KEYS } from '../domain/objections.js';
import { Role } from '../domain/enums.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validParams, validate } from '../middleware/validate.js';
import { completeObjectionsBlock, objectionsState } from '../services/objections.service.js';

const params = z.object({ key: z.enum(OBJECTIONS_KEYS) });
export const objectionsRouter = Router();
objectionsRouter.use(requireAuth, requireRole(Role.ADVISOR));
objectionsRouter.get('/module', async (request, response) => {
  response.json({ data: await objectionsState(request.usuario!.id) });
});
objectionsRouter.post('/blocks/:key/complete', validate({ params, body: z.object({}).strict() }), async (request, response) => {
  response.json({ data: await completeObjectionsBlock(request.usuario!.id, validParams<z.infer<typeof params>>(request).key) });
});
