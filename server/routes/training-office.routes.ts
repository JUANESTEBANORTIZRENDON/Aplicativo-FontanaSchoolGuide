import { Router } from 'express';
import { z } from 'zod';
import * as office from '../controllers/training-office.controller.js';
import { Role } from '../domain/enums.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { attemptParams, sectionParams, typingCompleteBody } from '../validators/office.validator.js';

// /api/training/office: solo asesores con acceso al módulo (el servidor lo comprueba en cada solicitud).
export const officeRouter = Router();
officeRouter.use(requireAuth, requireRole(Role.ADVISOR), office.officeAccess);

officeRouter.get('/module', office.moduleState);
officeRouter.get('/content/:section', validate({ params: z.object({ section: z.enum(['bienvenida', 'excel', 'ortografia']) }) }), office.content);
officeRouter.post('/sections/:sectionKey/view', validate({ params: sectionParams }), office.registerView);
officeRouter.get('/result', office.result);

officeRouter.post('/typing/attempts', office.typingPrepare);
officeRouter.post('/typing/attempts/:id/start', validate({ params: attemptParams }), office.typingStart);
officeRouter.post('/typing/attempts/:id/complete', validate({ params: attemptParams, body: typingCompleteBody }), office.typingComplete);
officeRouter.get('/typing/practice', office.typingPracticeTexts);
officeRouter.post('/typing/practice/complete', office.typingPractice);
