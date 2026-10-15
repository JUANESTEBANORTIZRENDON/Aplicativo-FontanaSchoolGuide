import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getStorage } from '../integrations/storage.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, validParams, validQuery } from '../middleware/validate.js';
import { describeMedia, verifySignedUrl } from '../services/media.service.js';
import { keyParams } from '../validators/office.validator.js';

// GET /api/media/:key?exp=…&sig=…  Archivos privados (audios e imágenes): firma vigente y sesión activa.
export const mediaRouter = Router();

const query = z.object({ exp: z.coerce.number().int(), sig: z.string().min(10).max(200) });

mediaRouter.get('/:key', requireAuth, validate({ params: keyParams, query }), async (request: Request, response: Response) => {
  const { key } = validParams<{ key: string }>(request);
  const { exp, sig } = validQuery<{ exp: number; sig: string }>(request);
  verifySignedUrl(key, exp, sig, request.usuario!.id);
  const media = await describeMedia(key);

  response.setHeader('Content-Type', media.contentType);
  response.setHeader('Accept-Ranges', 'bytes');
  response.setHeader('Cache-Control', 'private, max-age=60');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  const header = request.get('range');
  if (header) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
    if (!match || (match[1] === '' && match[2] === '')) { response.status(416).setHeader('Content-Range', `bytes */${media.size}`).end(); return; }
    let start: number;
    let end: number;
    if (match[1] === '') { const suffix = Number(match[2]); start = Math.max(0, media.size - suffix); end = media.size - 1; }
    else { start = Number(match[1]); end = match[2] === '' ? media.size - 1 : Math.min(Number(match[2]), media.size - 1); }
    if (start > end || start >= media.size) { response.status(416).setHeader('Content-Range', `bytes */${media.size}`).end(); return; }
    response.status(206);
    response.setHeader('Content-Range', `bytes ${start}-${end}/${media.size}`);
    response.setHeader('Content-Length', String(end - start + 1));
    getStorage().stream(key, { start, end }).pipe(response);
    return;
  }
  response.setHeader('Content-Length', String(media.size));
  getStorage().stream(key).pipe(response);
});
