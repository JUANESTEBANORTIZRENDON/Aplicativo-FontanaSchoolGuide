import type { NextFunction, Request, Response } from 'express';

export function apiNotFound(
  request: Request,
  response: Response,
  _next: NextFunction,
): void {
  response.status(404).json({
    status: 'error',
    message: `No existe la ruta ${request.method} ${request.originalUrl}`,
  });
}

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void {
  console.error(error);
  response.status(503).json({
    status: 'error',
    message: 'El servicio no está disponible temporalmente.',
  });
}
