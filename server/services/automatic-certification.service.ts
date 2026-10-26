import type { Prisma } from '@prisma/client';
import { certificationRequirements, compactTraining } from './certification.service.js';
import { loadSnapshot } from './progress.service.js';
import { createWithUniqueCode } from './certificate.service.js';
import { audit } from './audit.service.js';

// El envío del examen mantiene bloqueado al asesor durante toda esta transacción.
// Se valida la evidencia real; un reintento no duplica certificados ni reactiva uno anulado.
export async function certifyAfterFinalExam(tx: Prisma.TransactionClient, userId: string, now = new Date()) {
  const existing = await tx.certificate.findFirst({ where: { userId }, orderBy: { issuedAt: 'desc' } });
  if (existing) return existing.status === 'ACTIVE' ? existing : null;
  const snapshot = await loadSnapshot(tx, userId, now);
  const requirements = await certificationRequirements(tx, userId, snapshot);
  if (!requirements.met) return null;
  const certificate = await createWithUniqueCode(tx, { userId, status: 'ACTIVE', issuedAt: now });
  const summary = await compactTraining(tx, userId, certificate, null);
  await audit(tx, { actorUserId: userId }, {
    action: 'CERTIFICATE_ISSUED', entityType: 'Certificate', entityId: certificate.id,
    reason: 'Emisión automática al aprobar el examen general y cumplir los requisitos.',
    after: { userId, certificateId: certificate.id, code: certificate.code, summaryId: summary.id, automatic: true },
  });
  return certificate;
}

