import { execSync } from 'node:child_process';
import { useTestDatabase } from './test-env.js';

// Preparación de la suite de evaluación y certificación: migraciones versionadas y catálogo base.
// No depende de los datos demo (cada prueba crea sus propios asesores).
export default async function setup(): Promise<void> {
  useTestDatabase();
  execSync('npx prisma migrate deploy', { stdio: 'pipe', env: process.env });
  const { prisma, disconnect } = await import('../config/prisma.js');
  const { seedCatalog } = await import('../../prisma/seed-base.js');
  await seedCatalog(prisma);
  await disconnect();
}
