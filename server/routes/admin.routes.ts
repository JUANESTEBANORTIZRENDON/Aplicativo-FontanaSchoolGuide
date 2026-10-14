import { Router } from 'express';
import { autenticar, soloAdministrador } from '../middleware/auth.middleware.js';
import { actualizarAsesor, crearAsesor, desactivarAsesor, listarAsesores } from '../controllers/admin.controller.js';

export const adminRouter = Router();
adminRouter.use(autenticar, soloAdministrador);
adminRouter.get('/asesores', listarAsesores);
adminRouter.post('/asesores', crearAsesor);
adminRouter.put('/asesores/:id', actualizarAsesor);
adminRouter.delete('/asesores/:id', desactivarAsesor);
