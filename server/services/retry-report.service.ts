import type { Db } from '../config/prisma.js';
import { prisma } from '../config/prisma.js';
import { ConflictError, NotFoundError } from '../domain/errors.js';
import { attemptResults, type AttemptResult } from './evaluation-result.service.js';
import { retryReportPdf } from '../utils/certificate-pdf.js';

export type RetryReport = {
  version: 1; name: string; document: string; issuedAt: string; activityId: string;
  attemptId: string; attemptNumber: number; activityTitle: string;
  scores: { title: string; score: string | null; minimum: string | null; passed: boolean }[];
  recommendations: string[]; attempts: AttemptResult[];
};

export function reportPdf(report: RetryReport, code = report.attemptId): Buffer {
  return retryReportPdf([
    `Asesor: ${report.name}`, `Documento: ${report.document}`,
    `Fecha: ${new Date(report.issuedAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`,
    `Seguimiento: ${code}`, `Evaluación: ${report.activityTitle} - Intento ${report.attemptNumber}`, '',
    'RESULTADOS REGISTRADOS (sobre 100)',
    ...report.scores.map(s => `${s.title}: ${s.score ?? 'Sin nota'} | ${s.minimum === null ? 'Puntaje orientativo' : `Mínimo: ${s.minimum}`} | ${s.minimum === null ? s.passed ? 'Completada' : 'Pendiente' : s.passed ? 'Aprobada' : 'No aprobada'}`), '',
    'RECOMENDACIONES DE REFUERZO', ...report.recommendations.map(r => `- ${r}`), '',
    'La aprobación de cada evaluación obligatoria requiere su nota mínima. Un promedio no sustituye ese requisito.',
    'AÚN NO APTO EN ESTA EVALUACIÓN. Este documento registra un resultado; no acredita la formación.',
    'Puedes activar un único reintento desde tu resultado. Si vuelves a fallar, solicita acompañamiento al administrador.',
    'La reactivación solo habilita esta evaluación. Tus módulos aprobados y el historial se conservan.',
  ]);
}

export async function retryReport(userId: string, activityId: string, db: Db = prisma, now = new Date()): Promise<RetryReport> {
  const [user, attempts] = await Promise.all([
    db.usuario.findUnique({ where: { id: userId }, select: { nombreCompleto: true, numeroDocumento: true } }),
    db.attempt.findMany({ where: { userId, submittedAt: { not: null } }, orderBy: { submittedAt: 'desc' },
      include: { evaluation: { include: { activity: { select: { id: true, title: true, type: true } } } } } }),
  ]);
  if (!user) throw new NotFoundError('Asesor no encontrado.');
  const target = attempts.find(a => a.evaluation.activityId === activityId);
  if (!target || target.status !== 'FAILED') throw new ConflictError('La constancia requiere una evaluación no aprobada.', 'RETRY_REPORT_NOT_AVAILABLE');
  const results = await attemptResults(db, attempts.filter(a => a.evaluation.activityId === activityId).map(a => a.id));
  const latest = new Map<string, typeof target>();
  for (const attempt of attempts) if (!latest.has(attempt.evaluation.activityId)) latest.set(attempt.evaluation.activityId, attempt);
  const recommendations = results.get(target.id)?.objections?.recommendations ?? results.get(target.id)?.finalExam?.recommendations ?? [];
  return {
    version: 1, name: user.nombreCompleto, document: user.numeroDocumento, issuedAt: now.toISOString(), activityId,
    attemptId: target.id, attemptNumber: target.number, activityTitle: target.evaluation.activity.title,
    scores: [...latest.values()].map(a => ({ title: a.evaluation.activity.title, score: a.score?.toFixed(2) ?? null,
      minimum: a.evaluation.activity.type === 'TYPIFICATION' ? null : a.evaluation.minimumScore.toFixed(2), passed: a.status === 'PASSED' })),
    recommendations: recommendations.length ? recommendations : [`Repasa ${target.evaluation.activity.title} y sus instrucciones antes de volver a practicar.`],
    attempts: [...results.values()],
  };
}
