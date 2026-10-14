import { randomBytes, randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { databaseModel } from '../models/database.model.js';

export async function asegurarAdministrador(): Promise<{ documento: string; password: string } | null> {
  const existing = await databaseModel.client.usuario.findFirst({
    where: { rol: { in: ['administrador', 'admin', 'administrator'] } },
    select: { id: true },
  });
  if (existing) return null;
  const documento = `99${randomInt(10_000_000, 100_000_000)}`;
  const password = randomBytes(18).toString('base64url');
  await databaseModel.client.usuario.create({
    data: {
      nombreCompleto: 'Administrador inicial',
      numeroDocumento: documento,
      passwordHash: await bcrypt.hash(password, 12),
      rol: 'administrador',
      estado: 'activo',
      debeCompletarDatos: false,
      debeCambiarPassword: true,
    },
  });
  return { documento, password };
}
