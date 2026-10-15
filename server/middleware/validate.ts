import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';

type Schemas = { body?: z.ZodType; query?: z.ZodType; params?: z.ZodType };

// Valida y guarda el resultado en request.valid. Express 5 no permite reasignar request.query.
export function validate(schemas: Schemas) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    request.valid = {
      body: schemas.body ? schemas.body.parse(request.body ?? {}) : undefined,
      query: schemas.query ? schemas.query.parse(request.query) : undefined,
      params: schemas.params ? schemas.params.parse(request.params) : undefined,
    };
    next();
  };
}

export function validBody<T>(request: Request): T { return request.valid!.body as T; }
export function validQuery<T>(request: Request): T { return request.valid!.query as T; }
export function validParams<T>(request: Request): T { return request.valid!.params as T; }
