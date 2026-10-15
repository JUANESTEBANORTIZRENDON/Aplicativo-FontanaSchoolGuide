import 'dotenv/config';
import { assertSafeDatabase } from './guard.js';

// Seed base: catálogo de la sección 6.1 y asesor de prueba. Idempotente.
try {
  const host = assertSafeDatabase('db:seed');
  const { prisma, disconnect } = await import('../server/config/prisma.js');
  const { seedCatalog, seedTestAdvisor, CATALOG, TEST_ADVISOR } = await import('./seed-base.js');
  try {
    await seedCatalog(prisma);
    await seedTestAdvisor(prisma);
    console.log(`Seed base aplicado en ${host}: ${CATALOG.length} módulos y asesor de prueba ${TEST_ADVISOR.documento}.`);
  } finally {
    await disconnect();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
