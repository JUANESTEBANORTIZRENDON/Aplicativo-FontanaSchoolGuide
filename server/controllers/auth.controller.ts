import type { Request, Response } from 'express';
import { AppError } from '../domain/errors.js';
import { permisosUsuario, serializarUsuario } from '../domain/usuario.js';
import { validBody } from '../middleware/validate.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import * as authService from '../services/auth.service.js';
import { borrarSesion, crearSesion } from '../services/session.service.js';
import type { AvanceInduccionBody, CompletarDatosBody, ExperienciaBody, LoginBody } from '../validators/auth.validator.js';

export async function login(request: Request, response: Response): Promise<void> {
  const body = validBody<LoginBody>(request);
  const ip = request.ip ?? 'unknown';
  try {
    const usuario = await authService.login(body, { ip, requestId: request.requestId });
    await loginLimiter.succeed(ip, body.identificador);
    crearSesion(response, usuario.id, usuario.versionSesion);
    response.json({ usuario: serializarUsuario(usuario) });
  } catch (error) {
    if (error instanceof AppError && error.status === 401) await loginLimiter.fail(ip, body.identificador);
    throw error;
  }
}

export function me(request: Request, response: Response): void {
  response.json({ usuario: serializarUsuario(request.usuario!), permisos: permisosUsuario(request.usuario!) });
}

export function logout(_request: Request, response: Response): void {
  borrarSesion(response);
  response.status(204).end();
}

export async function logoutEverywhere(request: Request, response: Response): Promise<void> {
  await authService.logoutEverywhere(request.usuario!.id);
  borrarSesion(response);
  response.status(204).end();
}

export async function completarDatos(request: Request, response: Response): Promise<void> {
  const usuario = await authService.completarDatos(request.usuario!, validBody<CompletarDatosBody>(request));
  response.json({ usuario: serializarUsuario(usuario) });
}

export async function registrarAvanceInduccion(request: Request, response: Response): Promise<void> {
  const usuario = await authService.registrarAvanceInduccion(request.usuario!, validBody<AvanceInduccionBody>(request));
  response.json({ usuario: serializarUsuario(usuario) });
}

export async function registrarExperiencia(request: Request, response: Response): Promise<void> {
  const usuario = await authService.registrarExperiencia(request.usuario!, validBody<ExperienciaBody>(request));
  response.json({ usuario: serializarUsuario(usuario) });
}
