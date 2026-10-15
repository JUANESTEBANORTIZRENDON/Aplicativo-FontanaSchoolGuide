import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { usuarios, esAdministrador, rutaUsuario, usuarioPublico } from '../models/usuario.model.js';
import { borrarSesion, crearSesion } from '../services/session.service.js';

const intentos = new Map<string, { count: number; until: number }>();

function texto(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max + 1) : '';
}

function serializar(usuario: NonNullable<Request['usuario']>) {
  const { passwordHash: _passwordHash, ...safe } = usuario;
  void _passwordHash;
  return {
    id: safe.id,
    nombreCompleto: safe.nombreCompleto,
    numeroDocumento: safe.numeroDocumento,
    tipoDocumento: safe.tipoDocumento,
    correo: safe.correo,
    telefono: safe.telefono,
    rol: safe.rol,
    estado: safe.estado,
    debeCompletarDatos: safe.debeCompletarDatos,
    debeCambiarPassword: safe.debeCambiarPassword,
    tieneExperienciaCobranzasDigitales: safe.tieneExperienciaCobranzasDigitales,
    ruta: rutaUsuario(safe),
  };
}

export async function login(request: Request, response: Response, next: NextFunction): Promise<void> {
  const identificador = texto(request.body?.identificador, 150);
  const password = request.body?.password;
  const tipo = request.body?.tipo;
  const key = request.ip ?? 'unknown';
  const attempt = intentos.get(key);
  if (attempt && attempt.until > Date.now() && attempt.count >= 8) {
    response.status(429).json({ message: 'Demasiados intentos. Espera 15 minutos.' });
    return;
  }
  if (!identificador || identificador.length > 150 || typeof password !== 'string' || !['asesor', 'administrador'].includes(tipo)) {
    response.status(400).json({ message: 'Completa los datos de acceso.' });
    return;
  }
  try {
    const usuario = await usuarios.findFirst({
      where: tipo === 'asesor'
        ? { numeroDocumento: identificador }
        : { OR: [{ numeroDocumento: identificador }, { correo: { equals: identificador, mode: 'insensitive' } }] },
    });
    const valid = usuario && await bcrypt.compare(password, usuario.passwordHash);
    const roleMatches = usuario && (tipo === 'administrador' ? esAdministrador(usuario.rol) : usuario.rol === 'asesor');
    if (!valid || !roleMatches || usuario?.estado !== 'activo') {
      intentos.set(key, { count: (attempt?.until && attempt.until > Date.now() ? attempt.count : 0) + 1, until: Date.now() + 15 * 60_000 });
      response.status(401).json({ message: 'Credenciales incorrectas o cuenta inactiva.' });
      return;
    }
    intentos.delete(key);
    await usuarios.update({ where: { id: usuario.id }, data: { ultimoAcceso: new Date() } });
    crearSesion(response, usuario.id);
    response.json({ usuario: serializar(usuario) });
  } catch (error) { next(error); }
}

export function me(request: Request, response: Response): void {
  response.json({ usuario: serializar(request.usuario!) });
}

export function logout(_request: Request, response: Response): void {
  borrarSesion(response);
  response.status(204).end();
}

export async function completarDatos(request: Request, response: Response, next: NextFunction): Promise<void> {
  if (request.usuario!.rol !== 'asesor') { response.status(403).json({ message: 'Este formulario es para asesores.' }); return; }
  const { correo, telefono } = request.body ?? {};
  const email = texto(correo, 150);
  const phone = texto(telefono, 30);
  if (!email || email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    response.status(400).json({ message: 'Ingresa un correo válido con @ y dominio, por ejemplo nombre@empresa.com.' }); return;
  }
  if (phone.length > 30) {
    response.status(400).json({ message: 'El teléfono debe tener como máximo 30 caracteres.' }); return;
  }
  try {
    const usuario = await usuarios.update({
      where: { id: request.usuario!.id },
      data: {
        correo: email,
        telefono: phone || null,
        debeCompletarDatos: false,
        debeCambiarPassword: false,
        fechaDatosCompletados: new Date(),
        fechaActualizacion: new Date(),
      },
    });
    response.json({ usuario: serializar(usuario) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      response.status(409).json({ message: 'Este correo ya está registrado en otra cuenta. Usa un correo diferente.' });
      return;
    }
    next(error);
  }
}

export async function registrarExperiencia(request: Request, response: Response, next: NextFunction): Promise<void> {
  if (request.usuario!.rol !== 'asesor' || request.usuario!.debeCompletarDatos) {
    response.status(403).json({ message: 'Completa tu perfil de asesor antes de continuar.' }); return;
  }
  const experiencia = request.body?.tieneExperienciaCobranzasDigitales;
  if (typeof experiencia !== 'boolean') {
    response.status(400).json({ message: 'Selecciona si tienes experiencia en cobranzas digitales.' }); return;
  }
  try {
    const usuario = await usuarios.update({
      where: { id: request.usuario!.id },
      data: { tieneExperienciaCobranzasDigitales: experiencia, fechaRespuestaExperiencia: new Date(), fechaActualizacion: new Date() },
    });
    response.json({ usuario: serializar(usuario) });
  } catch (error) { next(error); }
}

export { usuarioPublico };
