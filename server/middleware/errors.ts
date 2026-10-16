import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../domain/errors.js';

type ErrorBody = { status: 'error'; code: string; message: string; details: Record<string, unknown>; requestId?: string };

function send(request: Request, response: Response, status: number, code: string, message: string, details: Record<string, unknown> = {}): void {
  const body: ErrorBody = { status: 'error', code, message, details, requestId: request.requestId };
  response.status(status).json(body);
}

export function zodDetails(error: ZodError): Record<string, string> {
  const details: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : (issue.code === 'unrecognized_keys' ? (issue as { keys: string[] }).keys.join(',') : '_');
    details[key] ??= issue.code === 'unrecognized_keys' ? 'Campo no permitido.' : issue.message;
  }
  return details;
}

function isConnectionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  return error instanceof Prisma.PrismaClientKnownRequestError && ['P1001', 'P1002', 'P1008', 'P1017', 'P2024'].includes(error.code);
}

export function apiNotFound(request: Request, response: Response): void {
  send(request, response, 404, 'ROUTE_NOT_FOUND', `No existe la ruta ${request.method} ${request.originalUrl}`);
}

export function errorHandler(error: unknown, request: Request, response: Response, _next: NextFunction): void {
  if (error instanceof AppError) { send(request, response, error.status, error.code, error.message, error.details); return; }
  if (error instanceof ZodError) { send(request, response, 400, 'VALIDATION_ERROR', 'Revisa los datos enviados.', zodDetails(error)); return; }
  if (typeof error === 'object' && error !== null && (error as { type?: string }).type === 'entity.too.large') {
    send(request, response, 413, 'PAYLOAD_TOO_LARGE', 'El archivo supera el tamaño permitido.');
    return;
  }
  if (error instanceof SyntaxError && 'body' in error) { send(request, response, 400, 'INVALID_JSON', 'El cuerpo de la solicitud no es JSON válido.'); return; }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') { send(request, response, 409, 'CONFLICT', 'Ya existe un registro con esos datos.', { fields: error.meta?.target ?? null }); return; }
    if (error.code === 'P2025') { send(request, response, 404, 'NOT_FOUND', 'Recurso no encontrado.'); return; }
  }
  console.error(JSON.stringify({ event: 'unhandled_error', requestId: request.requestId, path: request.originalUrl, error: error instanceof Error ? error.stack : String(error) }));
  if (isConnectionError(error)) { send(request, response, 503, 'SERVICE_UNAVAILABLE', 'El servicio no está disponible temporalmente.'); return; }
  send(request, response, 500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado. Intenta nuevamente.');
}
