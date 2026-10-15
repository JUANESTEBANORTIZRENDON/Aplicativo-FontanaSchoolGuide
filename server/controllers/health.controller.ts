import type { Request, Response } from 'express';
import { checkConnection } from '../config/prisma.js';

export async function getHealth(request: Request, response: Response): Promise<void> {
  try {
    await checkConnection();
    response.status(200).json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error(JSON.stringify({ event: 'health_failed', requestId: request.requestId, error: error instanceof Error ? error.message : String(error) }));
    response.status(503).json({ status: 'error', code: 'SERVICE_UNAVAILABLE', message: 'El servicio no está disponible temporalmente.', details: {}, requestId: request.requestId });
  }
}
