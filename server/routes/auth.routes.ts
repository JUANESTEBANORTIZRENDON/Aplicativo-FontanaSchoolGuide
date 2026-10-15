import { Router } from 'express';
import { completarDatos, login, logout, logoutEverywhere, me, registrarExperiencia } from '../controllers/auth.controller.js';
import { Role } from '../domain/enums.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { limitarLogin } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { completarDatosBody, experienciaBody, loginBody } from '../validators/auth.validator.js';

export const authRouter = Router();
authRouter.post('/login', limitarLogin, validate({ body: loginBody }), login);
authRouter.get('/me', requireAuth, me);
authRouter.post('/logout', logout);
authRouter.post('/logout-all', requireAuth, logoutEverywhere);
authRouter.post('/completar-datos', requireAuth, requireRole(Role.ADVISOR), validate({ body: completarDatosBody }), completarDatos);
authRouter.post('/experiencia', requireAuth, requireRole(Role.ADVISOR), validate({ body: experienciaBody }), registrarExperiencia);
