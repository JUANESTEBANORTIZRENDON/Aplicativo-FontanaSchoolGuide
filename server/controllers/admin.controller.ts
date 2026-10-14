import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { usuarios, usuarioPublico } from '../models/usuario.model.js';

function string(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
}

export async function listarAsesores(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const search = typeof request.query.buscar === 'string' ? request.query.buscar.trim().slice(0, 80) : '';
    const page = Math.max(1, Math.min(100000, Number(request.query.pagina) || 1));
    const where: Prisma.UsuarioWhereInput = {
      rol: 'asesor',
      ...(search ? { OR: [
        { nombreCompleto: { contains: search, mode: 'insensitive' } },
        { numeroDocumento: { contains: search } },
      ] } : {}),
    };
    const [total, asesores] = await Promise.all([
      usuarios.count({ where }),
      usuarios.findMany({ where, select: usuarioPublico, orderBy: { fechaCreacion: 'desc' }, skip: (page - 1) * 20, take: 20 }),
    ]);
    response.json({ asesores, total, pagina: page, paginas: Math.max(1, Math.ceil(total / 20)) });
  } catch (error) { next(error); }
}

export async function crearAsesor(request: Request, response: Response, next: NextFunction): Promise<void> {
  const nombreCompleto = string(request.body?.nombreCompleto, 150);
  const numeroDocumento = string(request.body?.numeroDocumento, 30);
  const password = request.body?.password;
  if (!nombreCompleto || !numeroDocumento || typeof password !== 'string' || password.length < 10 || Buffer.byteLength(password, 'utf8') > 72) {
    response.status(400).json({ message: 'Nombre, documento y contraseña de al menos 10 caracteres son obligatorios. La contraseña admite hasta 72 bytes.' }); return;
  }
  try {
    const asesor = await usuarios.create({
      data: {
        nombreCompleto,
        numeroDocumento,
        passwordHash: await bcrypt.hash(password, 12),
        rol: 'asesor',
        estado: 'activo',
        debeCompletarDatos: true,
        debeCambiarPassword: true,
        creadoPor: request.usuario!.id,
      },
      select: usuarioPublico,
    });
    response.status(201).json({ asesor });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      response.status(409).json({ message: 'Ya existe un usuario con ese documento.' }); return;
    }
    next(error);
  }
}

export async function actualizarAsesor(request: Request, response: Response, next: NextFunction): Promise<void> {
  const id = String(request.params.id);
  try {
    const existing = await usuarios.findUnique({ where: { id } });
    if (!existing || existing.rol !== 'asesor') { response.status(404).json({ message: 'Asesor no encontrado.' }); return; }
    const nombreCompleto = string(request.body?.nombreCompleto, 150);
    const numeroDocumento = string(request.body?.numeroDocumento, 30);
    const estado = request.body?.estado;
    if (!nombreCompleto || !numeroDocumento || !['activo', 'inactivo'].includes(estado)) {
      response.status(400).json({ message: 'Revisa el nombre, documento y estado.' }); return;
    }
    const asesor = await usuarios.update({
      where: { id },
      data: { nombreCompleto, numeroDocumento, estado, fechaActualizacion: new Date() },
      select: usuarioPublico,
    });
    response.json({ asesor });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      response.status(409).json({ message: 'Ese documento ya está registrado.' }); return;
    }
    next(error);
  }
}

export async function desactivarAsesor(request: Request, response: Response, next: NextFunction): Promise<void> {
  const id = String(request.params.id);
  try {
    const existing = await usuarios.findUnique({ where: { id } });
    if (!existing || existing.rol !== 'asesor') { response.status(404).json({ message: 'Asesor no encontrado.' }); return; }
    const asesor = await usuarios.update({ where: { id }, data: { estado: 'inactivo', fechaActualizacion: new Date() }, select: usuarioPublico });
    response.json({ asesor });
  } catch (error) { next(error); }
}
