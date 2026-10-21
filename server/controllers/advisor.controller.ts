import type { Request, Response } from 'express';
import { validParams } from '../middleware/validate.js';
import * as progressService from '../services/progress.service.js';
import * as certificationService from '../services/certification.service.js';
import { env } from '../config/env.js';
import { TRAINING_NAME } from '../domain/certification.js';
import { certificatePdf } from '../utils/certificate-pdf.js';

export async function modules(request: Request, response: Response): Promise<void> {
  const views = await progressService.computeModuleState(request.usuario!.id, undefined, { sync: true });
  response.json({ data: views });
}

export async function moduleBySlug(request: Request, response: Response): Promise<void> {
  const { slug } = validParams<{ slug: string }>(request);
  response.json({ data: await progressService.getAccessibleModule(request.usuario!.id, slug) });
}

export async function progress(request: Request, response: Response): Promise<void> {
  response.json({ data: await progressService.getAdvisorSummary(request.usuario!.id) });
}

export async function certification(request: Request, response: Response): Promise<void> {
  response.json({ data: await certificationService.myCertification(request.usuario!.id) });
}

export async function celebrated(request: Request, response: Response): Promise<void> {
  await certificationService.markCelebrated(request.usuario!.id);
  response.status(204).end();
}

// El PDF del certificado activo del propio asesor.
export async function certificatePdfFile(request: Request, response: Response): Promise<void> {
  const certificate = await certificationService.certificateForPdf({ userId: request.usuario!.id });
  const pdf = certificatePdf({
    holder: certificate.user.nombreCompleto, trainingName: TRAINING_NAME, issuedAt: certificate.issuedAt, code: certificate.code,
    verifyUrl: `${request.protocol}://${request.get('host')}/verificar/${certificate.code}`, timeZone: env.APP_TIMEZONE,
  });
  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Disposition', `attachment; filename="certificado-${certificate.code}.pdf"`);
  response.send(pdf);
}
