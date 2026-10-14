import type { NextFunction, Request, Response } from 'express';
import type { Usuario } from '@prisma/client';
import { usuarios, esAdministrador } from '../models/usuario.model.js';
import { borrarSesion, leerSesion } from '../services/session.service.js';

declare global {
  namespace Express {
    interface Request { usuario?: Usuario }
  }
}

export function mismaProcedencia(request: Request, response: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) { next(); return; }
  const origin = request.get('origin');
  const host = request.get('host');
  if (!origin || !host) { response.status(403).json({ message: 'Origen no permitido.' }); return; }
  try {
    const parsed = new URL(origin);
    const localVite = process.env.NODE_ENV !== 'production' && parsed.origin === 'http://127.0.0.1:5173' && host === '127.0.0.1:3000';
    if ((!localVite && parsed.host !== host) || !['http:', 'https:'].includes(parsed.protocol)) {
      response.status(403).json({ message: 'Origen no permitido.' }); return;
    }
  } catch {
    response.status(403).json({ message: 'Origen no permitido.' }); return;
  }
  next();
}

export async function autenticar(request: Request, response: Response, next: NextFunction): Promise<void> {
  const id = leerSesion(request);
  if (!id) { response.status(401).json({ message: 'Inicia sesión para continuar.' }); return; }
  try {
    const usuario = await usuarios.findUnique({ where: { id } });
    if (!usuario || usuario.estado !== 'activo') {
      borrarSesion(response);
      response.status(401).json({ message: 'La sesión ya no está activa.' });
      return;
    }
    request.usuario = usuario;
    next();
  } catch (error) { next(error); }
}

export function soloAdministrador(request: Request, response: Response, next: NextFunction): void {
  if (!request.usuario || !esAdministrador(request.usuario.rol)) {
    response.status(403).json({ message: 'Acceso reservado al administrador.' });
    return;
  }
  next();
}
