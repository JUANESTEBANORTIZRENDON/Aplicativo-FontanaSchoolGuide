export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado.', code = 'NOT_FOUND') { super(404, code, message); }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Inicia sesión para continuar.', code = 'UNAUTHENTICATED') { super(401, code, message); }
}

export class ForbiddenError extends AppError {
  constructor(message = 'No tienes permiso para esta acción.', code = 'FORBIDDEN', details?: Record<string, unknown>) {
    super(403, code, message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = 'CONFLICT', details?: Record<string, unknown>) { super(409, code, message, details); }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>, code = 'VALIDATION_ERROR') { super(400, code, message, details); }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Demasiados intentos. Espera unos minutos.', details?: Record<string, unknown>) {
    super(429, 'TOO_MANY_REQUESTS', message, details);
  }
}
