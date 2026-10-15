import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../domain/errors.js';
import { contentTypeOf, detectMediaType, getStorage, MEDIA_KEY, MEDIA_LIMITS } from '../integrations/storage.js';
import { audit, type ActionContext } from './audit.service.js';
import { prisma } from '../config/prisma.js';
import { createHash } from 'node:crypto';

// URLs firmadas de corta duración: HMAC sobre clave, vencimiento y usuario. Además la entrega
// exige una sesión activa, así que una URL copiada no sirve para otra persona.

function secret(): string {
  const value = env.MEDIA_SIGNING_SECRET ?? env.SESSION_SECRET;
  if (!value) throw new Error('Define MEDIA_SIGNING_SECRET o SESSION_SECRET para firmar los archivos.');
  return value;
}

function signature(key: string, expiresAt: number, userId: string): string {
  return createHmac('sha256', secret()).update(`${key}.${expiresAt}.${userId}`).digest('base64url');
}

export function signedUrl(key: string, userId: string, now = new Date(), ttlSeconds = env.MEDIA_URL_TTL_SECONDS): { url: string; expiresAt: string } {
  const exp = Math.floor(now.getTime() / 1000) + ttlSeconds;
  return { url: `/api/media/${key}?exp=${exp}&sig=${signature(key, exp, userId)}`, expiresAt: new Date(exp * 1000).toISOString() };
}

export function verifySignedUrl(key: string, exp: number, sig: string, userId: string, now = new Date()): void {
  if (!MEDIA_KEY.test(key)) throw new NotFoundError('Archivo no encontrado.', 'MEDIA_NOT_FOUND');
  if (!Number.isFinite(exp) || exp * 1000 < now.getTime()) throw new ForbiddenError('El enlace del archivo venció. Vuelve a abrir la actividad.', 'MEDIA_URL_EXPIRED');
  const expected = Buffer.from(signature(key, exp, userId));
  const provided = Buffer.from(sig);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) throw new ForbiddenError('El enlace del archivo no es válido.', 'MEDIA_URL_INVALID');
}

export type StoredMedia = { key: string; contentType: string; size: number };

export async function describeMedia(key: string): Promise<StoredMedia> {
  const size = await getStorage().size(key);
  const contentType = contentTypeOf(key);
  if (size === null || !contentType) throw new NotFoundError('Archivo no encontrado.', 'MEDIA_NOT_FOUND');
  return { key, contentType, size };
}

// Carga desde el panel: valida bytes mágicos, tipo permitido, tamaño y que la extensión coincida.
export async function uploadMedia(key: string, body: unknown, context: ActionContext, reason?: string) {
  if (!MEDIA_KEY.test(key)) throw new ValidationError('La clave del archivo no es válida.', { key: 'Usa letras, números, punto, guion y guion bajo.' });
  if (!Buffer.isBuffer(body) || body.length === 0) throw new ValidationError('Envía el archivo como cuerpo binario.', { body: 'Cuerpo vacío o no binario.' });
  const detected = detectMediaType(body);
  if (!detected) throw new ValidationError('Tipo de archivo no permitido. Usa WebP, OGG o MP3.', { body: 'Formato no reconocido.' }, 'MEDIA_TYPE_NOT_ALLOWED');
  if (contentTypeOf(key) !== detected) throw new ValidationError('La extensión de la clave no coincide con el contenido del archivo.', { key: `Debe terminar en la extensión de ${detected}.` }, 'MEDIA_EXTENSION_MISMATCH');
  if (body.length > MEDIA_LIMITS[detected]) {
    throw new ValidationError(`El archivo supera el límite de ${Math.round(MEDIA_LIMITS[detected] / 1024 / 1024)} MB.`, { body: 'Archivo demasiado grande.' }, 'MEDIA_TOO_LARGE');
  }
  const existed = await getStorage().exists(key);
  await getStorage().put(key, body, detected);
  const sha256 = createHash('sha256').update(body).digest('hex');
  await audit(prisma, context, {
    action: 'OFFICE_MEDIA_UPLOADED', entityType: 'OfficeMedia', entityId: key,
    after: { key, contentType: detected, bytes: body.length, sha256, replaced: existed }, reason: reason ?? null,
  });
  return { key, contentType: detected, bytes: body.length, replaced: existed };
}

export async function listMedia(keys: string[]) {
  return Promise.all(keys.map(async (key) => ({ key, exists: await getStorage().exists(key), size: await getStorage().size(key) })));
}
