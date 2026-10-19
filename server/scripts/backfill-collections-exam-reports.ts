import { prisma, disconnect } from '../config/prisma.js';
import { COLLECTIONS_SLUG } from '../domain/collections.js';
import { EXAM_HISTORY_PREFIX } from '../domain/collections-exam.js';
import { buildExamCoaching, readExamCoaching, readExamResult } from '../domain/collections-exam-report.js';
import type { Prisma } from '@prisma/client';

// Completa únicamente recomendaciones faltantes en intentos ya archivados.
// No recalifica ni cambia respuestas, fechas de envío, puntajes o aprobaciones.
// Sin --apply solo informa cuántos registros pueden completarse.
async function main() {
  const apply = process.argv.includes('--apply');
  let cursor: string | undefined;
  let reviewed = 0; let eligible = 0; let updated = 0; let unsupported = 0;
  for (;;) {
    const rows = await prisma.collectionsBlockProgress.findMany({
      where: { module: { slug: COLLECTIONS_SLUG }, blockKey: { startsWith: EXAM_HISTORY_PREFIX } },
      orderBy: { id: 'asc' }, take: 100, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    for (const row of rows) {
      reviewed++;
      const payload = row.answers as Record<string, Prisma.InputJsonValue> | null;
      const result = readExamResult(payload?.result);
      if (!result) { unsupported++; continue; }
      if (readExamCoaching(payload?.coaching)) continue;
      eligible++;
      if (apply) {
        const coaching = buildExamCoaching(result);
        // Los archivos enviados son inmutables. La condición evita sobrescribir
        // una actualización simultánea o un reinicio administrativo.
        const saved = await prisma.collectionsBlockProgress.updateMany({ where: { id: row.id, updatedAt: row.updatedAt }, data: { answers: { ...payload, coaching } } });
        updated += saved.count;
      }
    }
    if (rows.length < 100) break;
    cursor = rows.at(-1)!.id;
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', reviewed, eligible, updated, unsupported }));
}
main().catch(() => { console.error('No se pudo completar la consulta o actualización del historial. No se muestran credenciales ni datos personales.'); process.exitCode = 1; }).finally(disconnect);
