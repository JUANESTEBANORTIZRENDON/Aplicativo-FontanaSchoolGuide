import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { setPrerequisites } from '../server/services/catalog.service.js';
import { initializeForUser } from '../server/services/progress.service.js';

// Catálogo inicial (sección 6.1). Upsert por slug; se puede ejecutar varias veces.
export const CATALOG = [
  { order: 1, slug: 'ofimatica-mecanografia', name: 'Ofimática y mecanografía', route: '/induccion/modulos/ofimatica-mecanografia', prerequisites: [] as string[] },
  { order: 2, slug: 'simulador-cobranzas', name: 'Simulador de cobranzas', route: '/induccion/modulos/simulador-cobranzas', prerequisites: ['ofimatica-mecanografia'] },
  { order: 3, slug: 'tipificacion-llamadas', name: 'Tipificación de llamadas', route: '/induccion/modulos/tipificacion-llamadas', prerequisites: ['simulador-cobranzas'] },
  { order: 4, slug: 'certificado', name: 'Certificado', route: '/induccion/certificado', prerequisites: ['ofimatica-mecanografia', 'simulador-cobranzas', 'tipificacion-llamadas'] },
];

export const TEST_ADVISOR = { documento: '1000000001', nombre: 'Asesor Prueba Fontana', password: 'FontanaTest2026!' };

export async function seedCatalog(prisma: PrismaClient): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const item of CATALOG) {
    const module = await prisma.trainingModule.upsert({
      where: { slug: item.slug },
      create: { slug: item.slug, name: item.name, order: item.order, route: item.route, status: 'ACTIVE', isRequired: true },
      update: { name: item.name, route: item.route },
    });
    ids.set(item.slug, module.id);
    // Módulos 1 a 3: una actividad PLACEHOLDER activa y obligatoria, sin evaluación.
    if (item.slug !== 'certificado') {
      await prisma.activity.upsert({
        where: { moduleId_order: { moduleId: module.id, order: 1 } },
        create: { moduleId: module.id, order: 1, type: 'PLACEHOLDER', status: 'ACTIVE', isRequired: true, title: `${item.name}: contenido en preparación`, route: item.route },
        update: {},
      });
    }
  }
  await prisma.$transaction(async (tx) => {
    for (const item of CATALOG) await setPrerequisites(tx, ids.get(item.slug)!, item.prerequisites.map((slug) => ids.get(slug)!));
  });
  return ids;
}

// Asesor de prueba: solo se guarda el hash (bcrypt 12). No imprime contraseñas.
export async function seedTestAdvisor(prisma: PrismaClient): Promise<string> {
  const passwordHash = await bcrypt.hash(TEST_ADVISOR.password, 12);
  const user = await prisma.usuario.upsert({
    where: { numeroDocumento: TEST_ADVISOR.documento },
    create: {
      nombreCompleto: TEST_ADVISOR.nombre, numeroDocumento: TEST_ADVISOR.documento, passwordHash,
      rol: 'asesor', estado: 'activo', debeCompletarDatos: false, debeCambiarPassword: false,
    },
    update: { nombreCompleto: TEST_ADVISOR.nombre, passwordHash, rol: 'asesor', estado: 'activo', debeCompletarDatos: false },
  });
  await prisma.advisorProfile.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
  await prisma.$transaction(async (tx) => initializeForUser(tx, user.id));
  return user.id;
}
