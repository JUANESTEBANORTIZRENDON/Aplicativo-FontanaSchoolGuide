import { execSync } from 'node:child_process';
import { useTestDatabase } from './test-env.js';

// Prepara la base de pruebas una vez: migraciones versionadas, seed base y datos demo recientes
// (los escenarios con tiempos de espera dependen de la hora de siembra).
export default async function setup(): Promise<void> {
  useTestDatabase();
  execSync('npx prisma migrate deploy', { stdio: 'pipe', env: process.env });
  const { prisma, disconnect } = await import('../config/prisma.js');
  const { seedCatalog, seedTestAdvisor } = await import('../../prisma/seed-base.js');
  const { cleanDemo, runDemoSeed } = await import('../../prisma/seed-demo.js');
  const silent = () => {};
  await seedCatalog(prisma);
  await seedTestAdvisor(prisma);
  await cleanDemo(true, silent);
  await runDemoSeed(silent);
  await disconnect();
}
