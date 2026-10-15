import { Router } from 'express';
import { autenticar } from '../middleware/auth.middleware.js';
import { completarDatos, login, logout, me, registrarExperiencia } from '../controllers/auth.controller.js';

export const authRouter = Router();
authRouter.post('/login', login);
authRouter.get('/me', autenticar, me);
authRouter.post('/logout', logout);
authRouter.post('/completar-datos', autenticar, completarDatos);
authRouter.post('/experiencia', autenticar, registrarExperiencia);
