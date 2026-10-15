import { randomBytes, randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { BCRYPT_ROUNDS } from '../config/security.js';
import { ADMIN_ROLE_ALIASES, Role, UserStatus } from '../domain/enums.js';

export async function existeAdministrador(): Promise<boolean> {
  const existing = await prisma.usuario.findFirst({ where: { rol: { in: [...ADMIN_ROLE_ALIASES] } }, select: { id: true } });
  return Boolean(existing);
}

// Solo lo usa el script CLI `npm run admin:bootstrap`: la contraseña se muestra una vez en esa terminal.
export async function crearAdministradorInicial(): Promise<{ documento: string; password: string } | null> {
  if (await existeAdministrador()) return null;
  const documento = `99${randomInt(10_000_000, 100_000_000)}`;
  const password = randomBytes(18).toString('base64url');
  await prisma.usuario.create({
    data: {
      nombreCompleto: 'Administrador inicial',
      numeroDocumento: documento,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      rol: Role.ADMIN,
      estado: UserStatus.ACTIVE,
      debeCompletarDatos: false,
      debeCambiarPassword: true,
    },
  });
  return { documento, password };
}
