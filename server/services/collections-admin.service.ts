import { prisma } from '../config/prisma.js';
import { Role } from '../domain/enums.js';
import { NotFoundError, ValidationError } from '../domain/errors.js';
import { COLLECTIONS_SLUG } from '../domain/collections.js';
import { EXAM_HISTORY_PREFIX, EXAM_KEY } from '../domain/collections-exam.js';
import { buildExamCoaching, readExamCoaching, readExamResult } from '../domain/collections-exam-report.js';
import { findPublicById } from '../repositories/usuario.repository.js';

const PAGE_SIZE = 20;
type HistoryRow = { id: string; blockKey: string; contentVersion: number; answers: unknown; completedAt: Date | null; updatedAt: Date };
function readPayload(row: HistoryRow) {
  const payload = row.answers as { version?: number; attempt?: number; submittedAt?: string; result?: unknown; coaching?: unknown } | null;
  const result = readExamResult(payload?.result);
  return { payload, result };
}
function summary(row: HistoryRow) {
  const { payload, result } = readPayload(row);
  return {
    id: row.id, attempt: Number(row.blockKey.slice(EXAM_HISTORY_PREFIX.length)) || payload?.attempt || 0,
    submittedAt: payload?.submittedAt && Number.isFinite(Date.parse(payload.submittedAt)) ? payload.submittedAt : (row.completedAt ?? row.updatedAt).toISOString(),
    version: result?.version ?? payload?.version ?? null,
    score: result?.score ?? null, verdict: result?.verdict ?? null, detailAvailable: Boolean(result),
    sections: result?.sections.map((s) => ({ key: s.key, title: s.title, score: s.score, maxScore: s.maxScore })) ?? [],
  };
}
const whereHistory = (userId: string) => ({ userId, module: { slug: COLLECTIONS_SLUG }, blockKey: { startsWith: EXAM_HISTORY_PREFIX } });
async function advisor(userId: string) {
  const user = await findPublicById(prisma, userId);
  if (!user || user.rol !== Role.ADVISOR) throw new NotFoundError('Asesor no encontrado.', 'ADVISOR_NOT_FOUND');
  return { id: user.id, name: user.nombreCompleto, document: user.numeroDocumento };
}

// Solo lo invocan rutas con sesión y rol de administrador. Todas las consultas se
// acotan al perfil; nunca se acepta un identificador de intento de otro asesor.
export async function advisorCollectionsHistory(userId: string, cursor?: string) {
  const user = await advisor(userId);
  if (cursor && !(await prisma.collectionsBlockProgress.findFirst({ where: { ...whereHistory(userId), id: cursor }, select: { id: true } }))) throw new ValidationError('La página de historial no corresponde a este asesor.');
  const [rows, total, legacy] = await Promise.all([
    prisma.collectionsBlockProgress.findMany({ where: whereHistory(userId), orderBy: [{ completedAt: 'desc' }, { id: 'desc' }], take: PAGE_SIZE + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) }),
    prisma.collectionsBlockProgress.count({ where: whereHistory(userId) }),
    prisma.collectionsBlockProgress.findFirst({ where: { userId, module: { slug: COLLECTIONS_SLUG }, blockKey: EXAM_KEY }, orderBy: { updatedAt: 'desc' }, select: { attempts: true, answers: true } }),
  ]);
  const items = rows.slice(0, PAGE_SIZE).map(summary);
  const legacyPayload = legacy?.answers as { result?: unknown } | undefined;
  return {
    advisor: user, items, total,
    nextCursor: rows.length > PAGE_SIZE ? items.at(-1)!.id : null,
    legacyNotice: !cursor && legacy && !readExamResult(legacyPayload?.result) && legacy.attempts > 0
      ? 'Existe un registro de un formato anterior sin desglose de siete secciones. No se han inventado ni recalculado sus resultados.' : null,
  };
}

export async function advisorCollectionsAttempt(userId: string, attemptId: string) {
  const user = await advisor(userId);
  const row = await prisma.collectionsBlockProgress.findFirst({ where: { ...whereHistory(userId), id: attemptId } });
  if (!row) throw new NotFoundError('Intento no encontrado para este asesor.', 'EXAM_ATTEMPT_NOT_FOUND');
  const { payload, result } = readPayload(row);
  const coaching = result ? readExamCoaching(payload?.coaching) ?? buildExamCoaching(result) : null;
  return { advisor: user, ...summary(row), result, coaching, coachingSaved: Boolean(readExamCoaching(payload?.coaching)) };
}
