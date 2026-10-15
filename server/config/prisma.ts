import { Prisma, PrismaClient } from '@prisma/client';
import './env.js';

// Cliente único de Prisma para todo el servidor. Las transacciones interactivas (intentos,
// excepciones) hacen varias consultas seguidas; con la latencia de Neon los 5 s por defecto no bastan.
export const prisma = new PrismaClient({ transactionOptions: { maxWait: 10_000, timeout: 30_000 } });

// Cliente aceptado por los repositorios: el global o el de una transacción.
export type Db = PrismaClient | Prisma.TransactionClient;

export async function checkConnection(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
