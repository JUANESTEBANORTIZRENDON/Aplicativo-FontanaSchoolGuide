import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { setPrerequisites } from '../server/services/catalog.service.js';
import { initializeForUser } from '../server/services/progress.service.js';
import { OFFICE_MODULE_SLUG, SECTION_ORDER, SECTION_TITLE } from '../server/domain/office.js';
import { DICTATIONS, EXCEL_ANSWER_KEY, EXCEL_SCENARIO_DATA, SPELLING_RULES, TYPING_TEXTS } from './seed-office-content.js';

// Catálogo inicial (sección 6.1). Upsert por slug; se puede ejecutar varias veces.
export const CATALOG = [
  { order: 1, slug: 'ofimatica-mecanografia', name: 'Ofimática para tus cobranzas', route: '/induccion/modulos/ofimatica-mecanografia', prerequisites: [] as string[] },
  { order: 2, slug: 'induccion-cobranzas', name: 'Inducción a las cobranzas', route: '/induccion/modulos/induccion-cobranzas', prerequisites: ['ofimatica-mecanografia'] },
  { order: 3, slug: 'simulador-cobranzas', name: 'Simulador de cobranzas', route: '/induccion/modulos/simulador-cobranzas', prerequisites: ['induccion-cobranzas'] },
  { order: 4, slug: 'tipificacion-llamadas', name: 'Tipificación de llamadas', route: '/induccion/modulos/tipificacion-llamadas', prerequisites: ['simulador-cobranzas'] },
  { order: 5, slug: 'certificado', name: 'Certificado', route: '/induccion/certificado', prerequisites: ['ofimatica-mecanografia', 'induccion-cobranzas', 'simulador-cobranzas', 'tipificacion-llamadas'] },
];

export const INDUCTION_MODULE_SLUG = 'induccion-cobranzas';

// Introducción (solo para quien no tiene experiencia) y examen de inducción: 80 % y 3 intentos. Idempotente.
async function seedInduction(prisma: PrismaClient, moduleId: string, route: string): Promise<void> {
  await prisma.activity.upsert({
    where: { moduleId_order: { moduleId, order: 1 } },
    create: { moduleId, order: 1, type: 'LESSON', status: 'ACTIVE', isRequired: false, title: 'Introducción a las cobranzas', route },
    update: {},
  });
  const exam = await prisma.activity.upsert({
    where: { moduleId_order: { moduleId, order: 2 } },
    create: { moduleId, order: 2, type: 'QUIZ', status: 'ACTIVE', isRequired: true, title: 'Examen de inducción', route },
    update: {},
  });
  if (!(await prisma.evaluation.findFirst({ where: { activityId: exam.id } }))) {
    await prisma.evaluation.create({ data: { activityId: exam.id, version: 1, title: 'Examen de inducción', status: 'ACTIVE', minimumScore: 80, maxAttempts: 3, waitMinutes: 0 } });
  }
}

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
    // La inducción tiene introducción y examen (sin contenido todavía); el módulo 1 tiene sus actividades reales
    // (seedOfficeModule); los demás, una actividad PLACEHOLDER activa y obligatoria, sin evaluación.
    if (item.slug === INDUCTION_MODULE_SLUG) await seedInduction(prisma, module.id, item.route);
    else if (item.slug !== 'certificado' && item.slug !== OFFICE_MODULE_SLUG) {
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
  await seedOfficeModule(prisma, ids.get(OFFICE_MODULE_SLUG)!);
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

// Actividades, evaluaciones, configuración y contenido del módulo 1. Todo idempotente: no pisa el
// contenido que un administrador haya editado ni borra nada (el placeholder solo se archiva).
export async function seedOfficeModule(prisma: PrismaClient, moduleId: string): Promise<void> {
  const route = `/induccion/modulos/${OFFICE_MODULE_SLUG}`;
  const sections = [
    { section: 'bienvenida', type: 'LESSON', required: false },
    { section: 'mecanografia', type: 'TYPING', required: true },
    { section: 'excel', type: 'EXCEL_PRACTICE', required: true },
    { section: 'ortografia', type: 'DICTATION', required: true },
    { section: 'resultado', type: 'LESSON', required: false },
  ] as const;
  const evaluations: Record<string, { minimumScore: number; maxAttempts: number }> = {
    mecanografia: { minimumScore: 100, maxAttempts: 3 },
    excel: { minimumScore: 80, maxAttempts: 3 },
    ortografia: { minimumScore: 85, maxAttempts: 1 },
  };
  for (const item of sections) {
    const order = SECTION_ORDER[item.section];
    const activity = await prisma.activity.upsert({
      where: { moduleId_order: { moduleId, order } },
      create: { moduleId, order, type: item.type, status: 'ACTIVE', isRequired: item.required, title: SECTION_TITLE[item.section], route: `${route}/${item.section}` },
      update: {},
    });
    const evaluation = evaluations[item.section];
    if (evaluation && !(await prisma.evaluation.findFirst({ where: { activityId: activity.id } }))) {
      await prisma.evaluation.create({
        data: { activityId: activity.id, version: 1, title: SECTION_TITLE[item.section], status: 'ACTIVE', minimumScore: evaluation.minimumScore, maxAttempts: evaluation.maxAttempts, waitMinutes: 0 },
      });
    }
  }
  // El placeholder del orden 1 se conserva archivado para no perder su historial.
  await prisma.activity.updateMany({ where: { moduleId, order: 1, type: 'PLACEHOLDER', status: { not: 'ARCHIVED' } }, data: { status: 'ARCHIVED' } });

  if (!(await prisma.officeModuleConfig.findFirst({ where: { moduleKey: OFFICE_MODULE_SLUG, status: 'ACTIVE' } }))) {
    const last = await prisma.officeModuleConfig.aggregate({ where: { moduleKey: OFFICE_MODULE_SLUG }, _max: { version: true } });
    await prisma.officeModuleConfig.create({
      data: { moduleKey: OFFICE_MODULE_SLUG, version: (last._max.version ?? 0) + 1, status: 'ACTIVE', reason: 'Configuración inicial del módulo' },
    });
  }

  for (const text of TYPING_TEXTS) {
    await prisma.typingText.upsert({
      where: { key_version: { key: text.key, version: 1 } },
      create: { key: text.key, version: 1, title: text.title, content: text.content, status: 'ACTIVE' },
      update: {},
    });
  }
  const scenario = await prisma.excelActivity.findUnique({ where: { key_version: { key: 'cobranzas-basico', version: 1 } } });
  if (!scenario) {
    await prisma.excelActivity.create({
      data: {
        key: 'cobranzas-basico', version: 1, title: 'Excel para cobranzas: búsquedas, seguimiento, acuerdos y pagos', status: 'ACTIVE',
        scenarioData: EXCEL_SCENARIO_DATA as unknown as object, answerKey: EXCEL_ANSWER_KEY as unknown as object,
      },
    });
  }
  for (const rule of SPELLING_RULES) {
    await prisma.spellingRule.upsert({
      where: { key_version: { key: rule.key, version: 1 } },
      create: {
        key: rule.key, version: 1, category: rule.category, severity: rule.severity, weight: rule.weight,
        pairs: rule.pairs, explanation: rule.explanation, examples: rule.examples, status: 'ACTIVE',
      },
      update: {},
    });
  }
  // Los audios no se pueden inventar: los ejercicios quedan en borrador hasta subir el audio autorizado.
  for (const exercise of DICTATIONS) {
    await prisma.dictationExercise.upsert({
      where: { key_version: { key: exercise.key, version: 1 } },
      create: {
        key: exercise.key, version: 1, title: exercise.title, expectedText: exercise.expectedText, difficulty: exercise.difficulty,
        criticalRuleKeys: exercise.criticalRuleKeys, status: 'DRAFT',
      },
      update: {},
    });
  }
}
