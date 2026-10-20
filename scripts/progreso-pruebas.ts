// Ajusta el avance de la cuenta de pruebas (1021803088) módulo por módulo, con el mismo servicio que usa el
// interruptor «Completado / Vacío» del panel de administración.
//   npx tsx scripts/progreso-pruebas.ts                       → muestra el estado actual
//   npx tsx scripts/progreso-pruebas.ts completar <slug>...   → da los módulos por completados («bienvenida» también vale)
//   npx tsx scripts/progreso-pruebas.ts vaciar <slug>...      → los deja vacíos para probarlos de cero
import 'dotenv/config';
import { prisma } from '../server/config/prisma.js';
import { ADMIN_ROLE_ALIASES, UserStatus } from '../server/domain/enums.js';
import { COURSE_RESET_DOCUMENT } from '../server/services/course-reset.service.js';
import { loadSnapshot } from '../server/services/progress.service.js';
import { setModuleCompletion, setWelcomeCompletion } from '../server/services/test-progress.service.js';

const [command, ...slugs] = process.argv.slice(2);

async function show(userId: string): Promise<void> {
  const welcome = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { fechaHistoriaCompletada: true, fechaMetodoCompletado: true, fechaInduccionCompletada: true, tieneExperienciaCobranzasDigitales: true },
  });
  const done = (d: Date | null | undefined): string => (d ? 'completada' : 'pendiente');
  console.log(`  Bienvenida: historia ${done(welcome?.fechaHistoriaCompletada)} · método ${done(welcome?.fechaMetodoCompletado)} · inducción ${done(welcome?.fechaInduccionCompletada)} · experiencia ${welcome?.tieneExperienciaCobranzasDigitales ?? 'sin responder'}`);
  const { views } = await loadSnapshot(prisma, userId, new Date(), { sync: true });
  for (const v of [...views].sort((a, b) => a.order - b.order)) {
    console.log(`  ${String(v.order).padStart(2, '0')} ${v.name.padEnd(32)} ${v.status.padEnd(12)} ${v.progressPercent.padStart(6)} %${v.hasSeal ? '  sello' : ''}`);
  }
}

const user = await prisma.usuario.findUnique({ where: { numeroDocumento: COURSE_RESET_DOCUMENT }, select: { id: true, nombreCompleto: true } });
if (!user) throw new Error(`No existe el usuario ${COURSE_RESET_DOCUMENT}.`);
// La auditoría registra como autor al primer administrador activo.
const admin = await prisma.usuario.findFirst({ where: { rol: { in: [...ADMIN_ROLE_ALIASES] }, estado: UserStatus.ACTIVE }, select: { id: true }, orderBy: { fechaCreacion: 'asc' } });
if (!admin) throw new Error('No hay un administrador activo para registrar la auditoría.');

if (command === 'completar' || command === 'vaciar') {
  for (const slug of slugs) {
    if (slug === 'bienvenida') {
      await setWelcomeCompletion(user.id, command === 'completar', { actorUserId: admin.id, requestId: 'script-progreso-pruebas' });
      console.log(`${command === 'completar' ? '✓ completada' : '○ pendiente'}: Bienvenida`);
      continue;
    }
    const module = await prisma.trainingModule.findUnique({ where: { slug }, select: { id: true, name: true } });
    if (!module) throw new Error(`No existe el módulo ${slug}.`);
    const result = await setModuleCompletion(user.id, module.id, command === 'completar', { actorUserId: admin.id, requestId: 'script-progreso-pruebas' });
    console.log(`${command === 'completar' ? '✓ completado' : '○ vaciado'}: ${module.name}`, JSON.stringify(result));
  }
}
console.log(`Estado de ${user.nombreCompleto}:`);
await show(user.id);
await prisma.$disconnect();
