import { Router } from 'express';
import { z } from 'zod';
import { validParams, validate } from '../middleware/validate.js';
import { verifyCertificate } from '../services/certification.service.js';

// Verificación pública de un certificado por su código (lo que imprime el PDF). No exige sesión.
export const certificatesRouter = Router();
certificatesRouter.get('/verify/:code', validate({ params: z.object({ code: z.string().regex(/^[A-Za-z0-9-]{6,40}$/, 'Código inválido.') }) }), async (request, response) => {
  response.json({ data: await verifyCertificate(validParams<{ code: string }>(request).code) });
});
