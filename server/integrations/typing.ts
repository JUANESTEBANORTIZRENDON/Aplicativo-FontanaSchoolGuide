import { createHmac, timingSafeEqual } from 'node:crypto';
import express, { Router, type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { Role } from '../domain/enums.js';
import { NotFoundError, UnauthorizedError, ValidationError } from '../domain/errors.js';
import { zodDetails } from '../middleware/errors.js';

// OBSOLETO: la prueba de mecanografía del módulo de Ofimática es interna (server/services/office-typing.service.ts)
// y no usa proveedores externos. Este webhook y la tabla resultados_mecanografia se conservan sin cambios
// por compatibilidad y datos históricos; no se usan para calificar.
//
// BORRADOR de contrato (sin proveedor real):
//   POST /api/integrations/typing/webhook
//   Encabezado X-Typing-Signature: sha256=<hex de HMAC-SHA256(cuerpo crudo, TYPING_WEBHOOK_SECRET)>
//   Cuerpo JSON: { eventId, numeroDocumento, wpm, accuracy, errors, attemptId?, occurredAt? }
// Si TYPING_WEBHOOK_SECRET no está definido la ruta responde 404. Un evento repetido
// (provider, eventId) responde 200 sin reprocesar.

export const TYPING_PROVIDER = 'typing';

const payloadSchema = z.object({
  eventId: z.string().trim().min(1).max(150),
  numeroDocumento: z.string().trim().min(1).max(30),
  wpm: z.number().int().min(0).max(400),
  accuracy: z.number().min(0).max(100),
  errors: z.number().int().min(0).max(10_000),
  attemptId: z.uuid().optional(),
  occurredAt: z.iso.datetime({ offset: true }).optional(),
});

export function signTypingPayload(body: Buffer | string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

function validSignature(raw: Buffer, received: string | undefined, secret: string): boolean {
  if (!received) return false;
  const expected = Buffer.from(signTypingPayload(raw, secret));
  const actual = Buffer.from(received);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export type TypingProcessResult = { status: 'PROCESSED' | 'DUPLICATE' | 'FAILED'; eventId: string; error?: string };

// Registra el evento y crea el TypingResult. Lo usan el webhook y el seed demo.
export async function processTypingEvent(rawPayload: unknown): Promise<TypingProcessResult> {
  const parsed = payloadSchema.safeParse(rawPayload);
  if (!parsed.success) throw new ValidationError('Payload de mecanografía inválido.', zodDetails(parsed.error));
  const payload = parsed.data;
  let event;
  try {
    event = await prisma.webhookEvent.create({ data: { provider: TYPING_PROVIDER, providerEventId: payload.eventId, status: 'RECEIVED', payload: rawPayload as Prisma.InputJsonValue } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { status: 'DUPLICATE', eventId: payload.eventId };
    throw error;
  }
  const user = await prisma.usuario.findUnique({ where: { numeroDocumento: payload.numeroDocumento }, select: { id: true, rol: true } });
  if (!user || user.rol !== Role.ADVISOR) {
    const error = 'No existe un asesor con ese documento.';
    await prisma.webhookEvent.update({ where: { id: event.id }, data: { status: 'FAILED', error, processedAt: new Date() } });
    return { status: 'FAILED', eventId: payload.eventId, error };
  }
  await prisma.$transaction([
    prisma.typingResult.create({
      data: {
        userId: user.id, attemptId: payload.attemptId ?? null, providerEventId: payload.eventId,
        wpm: payload.wpm, accuracy: new Prisma.Decimal(payload.accuracy), errors: payload.errors, rawPayload: rawPayload as Prisma.InputJsonValue,
      },
    }),
    prisma.webhookEvent.update({ where: { id: event.id }, data: { status: 'PROCESSED', processedAt: new Date() } }),
  ]);
  return { status: 'PROCESSED', eventId: payload.eventId };
}

export const typingRouter = Router();

// express.raw solo en esta ruta: la firma se calcula sobre el cuerpo crudo.
typingRouter.post('/webhook', express.raw({ type: 'application/json', limit: '256kb' }), async (request: Request, response: Response) => {
  const secret = env.TYPING_WEBHOOK_SECRET;
  if (!secret) throw new NotFoundError(`No existe la ruta ${request.method} ${request.originalUrl}`, 'ROUTE_NOT_FOUND');
  const raw = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
  if (!validSignature(raw, request.get('x-typing-signature'), secret)) throw new UnauthorizedError('Firma inválida.', 'INVALID_SIGNATURE');
  let payload: unknown;
  try { payload = JSON.parse(raw.toString('utf8')); } catch { throw new ValidationError('El cuerpo no es JSON válido.'); }
  const result = await processTypingEvent(payload);
  response.status(200).json({ data: result });
});
