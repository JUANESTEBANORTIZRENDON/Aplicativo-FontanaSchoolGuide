import type { Request, Response } from 'express';
import { validParams } from '../middleware/validate.js';
import * as progressService from '../services/progress.service.js';

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
