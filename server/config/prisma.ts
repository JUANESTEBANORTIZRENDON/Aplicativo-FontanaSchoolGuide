import { Prisma, PrismaClient } from '@prisma/client';
import './env.js';

// Cliente único de Prisma para todo el servidor.
export const prisma = new PrismaClient();

// Cliente aceptado por los repositorios: el global o el de una transacción.
export type Db = PrismaClient | Prisma.TransactionClient;

export async function checkConnection(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
