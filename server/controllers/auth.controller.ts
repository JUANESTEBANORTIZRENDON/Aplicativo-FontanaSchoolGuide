import bcrypt from 'bcryptjs';
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

export async function cambiarPassword(request: Request, response: Response, next: NextFunction): Promise<void> {
  const actual = request.body?.actual;
  const nueva = request.body?.nueva;
  if (typeof actual !== 'string' || typeof nueva !== 'string' || nueva.length < 10 || Buffer.byteLength(nueva, 'utf8') > 72) {
    response.status(400).json({ message: 'La nueva contraseña debe tener al menos 10 caracteres y como máximo 72 bytes.' }); return;
  }
  try {
    if (!await bcrypt.compare(actual, request.usuario!.passwordHash)) {
      response.status(400).json({ message: 'La contraseña actual no coincide.' }); return;
    }
    const usuario = await usuarios.update({ where: { id: request.usuario!.id }, data: { passwordHash: await bcrypt.hash(nueva, 12), debeCambiarPassword: false, fechaActualizacion: new Date() } });
    response.json({ usuario: serializar(usuario) });
  } catch (error) { next(error); }
}

export async function completarDatos(request: Request, response: Response, next: NextFunction): Promise<void> {
  if (request.usuario!.rol !== 'asesor') { response.status(403).json({ message: 'Este formulario es para asesores.' }); return; }
  const { correo, telefono, tipoDocumento, tieneExperienciaCobranzasDigitales } = request.body ?? {};
  if (typeof tieneExperienciaCobranzasDigitales !== 'boolean') {
    response.status(400).json({ message: 'Indica si tienes experiencia en cobranzas digitales.' }); return;
  }
  const email = texto(correo, 150);
  const phone = texto(telefono, 30);
  const documentType = texto(tipoDocumento, 10) || 'CC';
  if (email.length > 150 || phone.length > 30 || documentType.length > 10 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    response.status(400).json({ message: 'Revisa el correo, teléfono y tipo de documento.' }); return;
  }
  try {
    const usuario = await usuarios.update({
      where: { id: request.usuario!.id },
      data: {
        correo: email || null,
        telefono: phone || null,
        tipoDocumento: documentType,
        tieneExperienciaCobranzasDigitales,
        fechaRespuestaExperiencia: new Date(),
        debeCompletarDatos: false,
        fechaDatosCompletados: new Date(),
        fechaActualizacion: new Date(),
      },
    });
    response.json({ usuario: serializar(usuario) });
  } catch (error) { next(error); }
}

export { usuarioPublico };
