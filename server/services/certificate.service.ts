import { randomInt } from 'node:crypto';
import { Prisma, type Certificate } from '@prisma/client';
import { prisma, type Db } from '../config/prisma.js';
import { CERTIFICATE_MODULE_SLUG } from '../domain/enums.js';
import { ConflictError, NotFoundError } from '../domain/errors.js';
import { activeSealsForUser } from '../repositories/progress.repository.js';
import { audit, type ActionContext } from './audit.service.js';

// Certificados: emisión automática tras el examen o aprobación administrativa de expedientes anteriores.
// El PDF se genera al descargarlo (utils/certificate-pdf.ts); fileUrl queda nulo.

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCode(year = new Date().getUTCFullYear()): string {
  let suffix = '';
  for (let index = 0; index < 6; index++) suffix += ALPHABET[randomInt(ALPHABET.length)];
  return `FSG-${year}-${suffix}`;
}

// Elegible = sello activo en todos los prerrequisitos del módulo "certificado".
export async function eligibility(db: Db, userId: string): Promise<{ eligible: boolean; missing: string[] }> {
  const certificateModule = await db.trainingModule.findUnique({
    where: { slug: CERTIFICATE_MODULE_SLUG },
    include: { prerequisites: { include: { prerequisite: { select: { id: true, name: true } } } } },
  });
  if (!certificateModule) return { eligible: false, missing: [] };
  const sealed = new Set((await activeSealsForUser(db, userId)).map((seal) => seal.moduleId));
  const missing = certificateModule.prerequisites.filter((edge) => !sealed.has(edge.prerequisiteModuleId)).map((edge) => edge.prerequisite.name);
  return { eligible: certificateModule.prerequisites.length > 0 && missing.length === 0, missing };
}

export async function createWithUniqueCode(db: Db, data: Omit<Prisma.CertificateUncheckedCreateInput, 'code'>, code?: string): Promise<Certificate> {
  if (code) return db.certificate.create({ data: { ...data, code } });
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateCode();
    if (!await db.certificate.findUnique({ where: { code: candidate }, select: { id: true } })) return db.certificate.create({ data: { ...data, code: candidate } });
  }
  throw new ConflictError('No se pudo generar un código de certificado único. Intenta de nuevo.', 'CERTIFICATE_CODE');
}

// Emisión directa: solo para datos demo. En la plataforma la hace approveCertification (con la validación final).
// Debe ejecutarse en una transacción. `code` solo lo fija el seed demo.
export async function issue(db: Db, userId: string, context: ActionContext | null, options: { code?: string } = {}): Promise<Certificate> {
  const { eligible, missing } = await eligibility(db, userId);
  if (!eligible) throw new ConflictError(`El asesor no tiene todos los sellos. Faltan: ${missing.join(', ')}.`, 'CERTIFICATE_NOT_ELIGIBLE', { missing });
  if (await db.certificate.findFirst({ where: { userId, status: 'ACTIVE' }, select: { id: true } })) throw new ConflictError('El asesor ya tiene un certificado activo.', 'CERTIFICATE_EXISTS');
  const certificate = await createWithUniqueCode(db, { userId, status: 'ACTIVE', issuedAt: new Date() }, options.code);
  if (context) await audit(db, context, { action: 'CERTIFICATE_ISSUED', entityType: 'Certificate', entityId: certificate.id, after: { ...certificate } });
  return certificate;
}

export async function revoke(id: string, reason: string, context: ActionContext): Promise<Certificate> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.certificate.findUnique({ where: { id } });
    if (!before) throw new NotFoundError('Certificado no encontrado.', 'CERTIFICATE_NOT_FOUND');
    if (before.status !== 'ACTIVE') throw new ConflictError('Solo se anula un certificado activo.', 'CERTIFICATE_NOT_ACTIVE');
    const after = await tx.certificate.update({ where: { id }, data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: reason } });
    await audit(tx, context, { action: 'CERTIFICATE_REVOKED', entityType: 'Certificate', entityId: id, before: { ...before }, after: { ...after }, reason });
    return after;
  });
}

// Reemisión: nuevo certificado enlazado. Si el anterior estaba ACTIVE pasa a REISSUED;
// si ya estaba REVOKED conserva ese estado y su motivo.
export async function reissue(id: string, reason: string, context: ActionContext, options: { code?: string } = {}): Promise<Certificate> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.certificate.findUnique({ where: { id }, include: { nextCertificate: { select: { id: true } } } });
    if (!before) throw new NotFoundError('Certificado no encontrado.', 'CERTIFICATE_NOT_FOUND');
    if (before.nextCertificate || before.status === 'REISSUED') throw new ConflictError('Este certificado ya fue reemitido.', 'CERTIFICATE_ALREADY_REISSUED');
    const { eligible, missing } = await eligibility(tx, before.userId);
    if (!eligible) throw new ConflictError(`El asesor no tiene todos los sellos. Faltan: ${missing.join(', ')}.`, 'CERTIFICATE_NOT_ELIGIBLE', { missing });
    if (before.status === 'ACTIVE') await tx.certificate.update({ where: { id }, data: { status: 'REISSUED' } });
    const created = await createWithUniqueCode(tx, { userId: before.userId, status: 'ACTIVE', issuedAt: new Date(), previousCertificateId: id, celebratedAt: before.celebratedAt }, options.code);
    // El resumen del ciclo formativo pasa a citar el certificado vigente.
    await tx.trainingCompletionSummary.updateMany({ where: { certificateId: id }, data: { certificateId: created.id, certificateCode: created.code } });
    const { nextCertificate: _next, ...previous } = before;
    void _next;
    await audit(tx, context, { action: 'CERTIFICATE_REISSUED', entityType: 'Certificate', entityId: created.id, before: previous, after: { ...created }, reason });
    return created;
  });
}
