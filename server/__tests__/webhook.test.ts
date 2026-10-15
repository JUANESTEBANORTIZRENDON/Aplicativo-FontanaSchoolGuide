import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { signTypingPayload } from '../integrations/typing.js';
import { cleanupSuite, createTestUser } from './helpers.js';
import { TEST_WEBHOOK_SECRET } from './test-env.js';

const SUITE = 'hook';
const path = '/api/integrations/typing/webhook';

function send(body: string, signature?: string) {
  const call = request(app).post(path).set('Content-Type', 'application/json');
  return (signature ? call.set('X-Typing-Signature', signature) : call).send(body);
}

describe('webhook de mecanografía', () => {
  const eventIds: string[] = [];
  afterAll(async () => {
    await prisma.webhookEvent.deleteMany({ where: { providerEventId: { in: eventIds } } });
    await cleanupSuite(SUITE);
  });

  it('rechaza una firma inválida', async () => {
    const body = JSON.stringify({ eventId: 'TEST-firma', numeroDocumento: 'x', wpm: 30, accuracy: 90, errors: 1 });
    expect((await send(body)).status).toBe(401);
    expect((await send(body, 'sha256=00')).status).toBe(401);
  });

  it('procesa un evento y no reprocesa duplicados', async () => {
    const user = await createTestUser(SUITE);
    const eventId = `TEST-evento-${Date.now()}`;
    eventIds.push(eventId);
    const body = JSON.stringify({ eventId, numeroDocumento: user.numeroDocumento, wpm: 45, accuracy: 96.5, errors: 2 });
    const first = await send(body, signTypingPayload(body, TEST_WEBHOOK_SECRET));
    expect(first.status).toBe(200);
    expect(first.body.data.status).toBe('PROCESSED');
    const second = await send(body, signTypingPayload(body, TEST_WEBHOOK_SECRET));
    expect(second.status).toBe(200);
    expect(second.body.data.status).toBe('DUPLICATE');
    expect(await prisma.typingResult.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.webhookEvent.count({ where: { providerEventId: eventId } })).toBe(1);
  });

  it('no requiere encabezado Origin (exenta de mismaProcedencia)', async () => {
    const body = JSON.stringify({ eventId: `TEST-desconocido-${Date.now()}`, numeroDocumento: 'TEST-no-existe', wpm: 30, accuracy: 90, errors: 1 });
    eventIds.push(JSON.parse(body).eventId);
    const response = await send(body, signTypingPayload(body, TEST_WEBHOOK_SECRET));
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('FAILED');
  });

  it('responde 404 si no hay secreto configurado', async () => {
    const previous = env.TYPING_WEBHOOK_SECRET;
    env.TYPING_WEBHOOK_SECRET = undefined;
    try {
      const body = JSON.stringify({ eventId: 'x' });
      expect((await send(body, signTypingPayload(body, TEST_WEBHOOK_SECRET))).status).toBe(404);
    } finally {
      env.TYPING_WEBHOOK_SECRET = previous;
    }
  });
});
