import { Router } from 'express';
import { autenticar } from '../middleware/auth.middleware.js';
import { cambiarPassword, completarDatos, login, logout, me } from '../controllers/auth.controller.js';

export const authRouter = Router();
authRouter.post('/login', login);
authRouter.get('/me', autenticar, me);
authRouter.post('/logout', logout);
authRouter.post('/cambiar-contrasena', autenticar, cambiarPassword);
authRouter.post('/completar-datos', autenticar, completarDatos);
