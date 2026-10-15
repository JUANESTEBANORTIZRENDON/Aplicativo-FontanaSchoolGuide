import { Router } from 'express';
import { z } from 'zod';
import { moduleBySlug, modules, progress } from '../controllers/advisor.controller.js';
import { Role } from '../domain/enums.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const advisorRouter = Router();
advisorRouter.use(requireAuth, requireRole(Role.ADVISOR));
advisorRouter.get('/modules', modules);
advisorRouter.get('/modules/:slug', validate({ params: z.object({ slug: z.string().regex(/^[a-z0-9-]{1,80}$/, 'Módulo inválido.') }) }), moduleBySlug);
advisorRouter.get('/progress', progress);
