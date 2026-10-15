import { Router } from 'express';
import { completarDatos, login, logout, logoutEverywhere, me, registrarAvanceInduccion, registrarExperiencia } from '../controllers/auth.controller.js';
import { Role } from '../domain/enums.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { limitarLogin } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { avanceInduccionBody, completarDatosBody, experienciaBody, loginBody } from '../validators/auth.validator.js';

export const authRouter = Router();
authRouter.post('/login', limitarLogin, validate({ body: loginBody }), login);
authRouter.get('/me', requireAuth, me);
authRouter.post('/logout', logout);
authRouter.post('/logout-all', requireAuth, logoutEverywhere);
authRouter.post('/completar-datos', requireAuth, requireRole(Role.ADVISOR), validate({ body: completarDatosBody }), completarDatos);
authRouter.post('/induccion/avance', requireAuth, requireRole(Role.ADVISOR), validate({ body: avanceInduccionBody }), registrarAvanceInduccion);
authRouter.post('/experiencia', requireAuth, requireRole(Role.ADVISOR), validate({ body: experienciaBody }), registrarExperiencia);
