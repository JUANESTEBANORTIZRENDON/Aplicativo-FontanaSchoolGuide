import type { NextFunction, Request, Response } from 'express';
import { OFFICE_MODULE_SLUG, type OfficeSection } from '../domain/office.js';
import { validBody, validParams, validQuery } from '../middleware/validate.js';
import * as dictationService from '../services/office-dictation.service.js';
import * as excelService from '../services/office-excel.service.js';
import * as moduleService from '../services/office-module.service.js';
import * as typingService from '../services/office-typing.service.js';
import { getAccessibleModule } from '../services/progress.service.js';
import type { DictationSubmitBody, ExcelActionBody, ExcelSubmitBody, TypingCompleteBody } from '../validators/office.validator.js';

// El acceso lo decide el servidor en cada solicitud: un módulo bloqueado responde 403 con su motivo
// también al entrar por URL directa. Un módulo aprobado sigue abierto para ver el resultado.
// El estado calculado se guarda en la respuesta para que el controlador no lo vuelva a consultar.
export async function officeAccess(request: Request, response: Response, next: NextFunction): Promise<void> {
  await getAccessibleModule(request.usuario!.id, OFFICE_MODULE_SLUG, { allowCompleted: true, onSnapshot: (snapshot) => { response.locals.snapshot = snapshot; } });
  next();
}

export async function moduleState(request: Request, response: Response): Promise<void> {
  response.json({ data: await moduleService.getModuleState(request.usuario!.id, new Date(), response.locals.snapshot) });
}

export async function content(request: Request, response: Response): Promise<void> {
  const { section } = request.params as { section: OfficeSection };
  response.json({ data: await moduleService.getContent(section, request.usuario!.id) });
}

export async function registerView(request: Request, response: Response): Promise<void> {
  const { sectionKey } = validParams<{ sectionKey: string }>(request);
  response.status(201).json({ data: await moduleService.registerView(request.usuario!.id, sectionKey) });
}

export async function result(request: Request, response: Response): Promise<void> {
  response.json({ data: await moduleService.getResult(request.usuario!.id, new Date(), response.locals.snapshot) });
}

export async function typingPrepare(request: Request, response: Response): Promise<void> {
  response.status(201).json({ data: await typingService.prepareAttempt(request.usuario!.id) });
}

export async function typingResume(request: Request, response: Response): Promise<void> {
  response.json({ data: await typingService.resumePrepared(request.usuario!.id) });
}

export async function typingStart(request: Request, response: Response): Promise<void> {
  const { id } = validParams<{ id: string }>(request);
  response.json({ data: await typingService.startOfficial(request.usuario!.id, id) });
}

export async function typingComplete(request: Request, response: Response): Promise<void> {
  const { id } = validParams<{ id: string }>(request);
  const body = validBody<TypingCompleteBody>(request);
  response.json({ data: await typingService.completeAttempt(request.usuario!.id, id, body) });
}

export async function typingPractice(request: Request, response: Response): Promise<void> {
  response.json({ data: await typingService.completePractice(request.usuario!.id) });
}

export async function typingPracticeTexts(_request: Request, response: Response): Promise<void> {
  response.json({ data: { texts: typingService.practiceTexts() } });
}

// ---- Excel ----
export async function excelActivity(request: Request, response: Response): Promise<void> {
  response.json({ data: await excelService.getActivity(request.usuario!.id) });
}

export async function excelStart(request: Request, response: Response): Promise<void> {
  const { id } = validParams<{ id: string }>(request);
  response.status(201).json({ data: await excelService.startPractice(request.usuario!.id, id) });
}

export async function excelSubmit(request: Request, response: Response): Promise<void> {
  const { id } = validParams<{ id: string }>(request);
  const body = validBody<ExcelSubmitBody>(request);
  response.json({ data: await excelService.submitPractice(request.usuario!.id, id, body) });
}

export async function excelAction(request: Request, response: Response): Promise<void> {
  const { id } = validParams<{ id: string }>(request);
  response.json({ data: await excelService.performAction(request.usuario!.id, id, validBody<ExcelActionBody>(request)) });
}

// ---- Dictado ----
export async function dictationNext(request: Request, response: Response): Promise<void> {
  response.json({ data: { exercise: await dictationService.describeNext(request.usuario!.id) } });
}

export async function dictationLessons(_request: Request, response: Response): Promise<void> {
  response.json({ data: { lessons: await dictationService.lessons() } });
}

export async function dictationMeta(request: Request, response: Response): Promise<void> {
  const { id } = validParams<{ id: string }>(request);
  const { attemptId } = validQuery<{ attemptId: string }>(request);
  response.json({ data: await dictationService.getMetadata(request.usuario!.id, id, attemptId) });
}

export async function dictationStart(request: Request, response: Response): Promise<void> {
  const { id } = validParams<{ id: string }>(request);
  response.status(201).json({ data: await dictationService.startDictation(request.usuario!.id, id) });
}

export async function dictationPlay(request: Request, response: Response): Promise<void> {
  const { id } = validParams<{ id: string }>(request);
  const { attemptId } = validBody<{ attemptId: string }>(request);
  response.json({ data: await dictationService.requestPlay(request.usuario!.id, id, attemptId) });
}

export async function dictationSubmit(request: Request, response: Response): Promise<void> {
  const { id } = validParams<{ id: string }>(request);
  const body = validBody<DictationSubmitBody>(request);
  response.json({ data: await dictationService.submitDictation(request.usuario!.id, id, body, { requestId: request.requestId }) });
}
