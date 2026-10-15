import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const VALID = /^[A-Za-z0-9._:-]{8,100}$/;

export function requestId(request: Request, response: Response, next: NextFunction): void {
  const received = request.get('x-request-id');
  request.requestId = received && VALID.test(received) ? received : randomUUID();
  response.setHeader('X-Request-Id', request.requestId);
  next();
}
