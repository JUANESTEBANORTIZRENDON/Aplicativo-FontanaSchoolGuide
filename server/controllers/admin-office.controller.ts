import type { Request, Response } from 'express';
import { OFFICE_IMAGES } from '../domain/office-content.js';
import { prisma } from '../config/prisma.js';
import { validBody, validParams } from '../middleware/validate.js';
import * as admin from '../services/office-admin.service.js';
import * as configService from '../services/office-config.service.js';
import * as mediaService from '../services/media.service.js';
import { actionContext } from './admin-users.controller.js';
import type {
  DictationBody, DictationPatch, ExcelActivityBody, ExcelActivityPatch, OfficeConfigBody, SpellingRuleBody, SpellingRulePatch, TypingTextBody, TypingTextPatch,
} from '../validators/office.validator.js';

const idOf = (request: Request) => validParams<{ id: string }>(request).id;

export async function getConfig(_request: Request, response: Response): Promise<void> {
  response.json({ data: await configService.getConfigWithHistory() });
}

export async function patchConfig(request: Request, response: Response): Promise<void> {
  const { reason, ...changes } = validBody<OfficeConfigBody>(request);
  response.json({ data: await configService.updateConfig(changes, reason, actionContext(request)) });
}

export async function listTexts(_request: Request, response: Response): Promise<void> {
  response.json({ data: await admin.listTexts() });
}
export async function createText(request: Request, response: Response): Promise<void> {
  response.status(201).json({ data: await admin.createText(validBody<TypingTextBody>(request), actionContext(request)) });
}
export async function patchText(request: Request, response: Response): Promise<void> {
  response.json({ data: await admin.updateText(idOf(request), validBody<TypingTextPatch>(request), actionContext(request)) });
}

export async function listExcel(_request: Request, response: Response): Promise<void> {
  response.json({ data: await admin.listExcelActivities() });
}
export async function createExcel(request: Request, response: Response): Promise<void> {
  response.status(201).json({ data: await admin.createExcelActivity(validBody<ExcelActivityBody>(request), actionContext(request)) });
}
export async function patchExcel(request: Request, response: Response): Promise<void> {
  response.json({ data: await admin.updateExcelActivity(idOf(request), validBody<ExcelActivityPatch>(request), actionContext(request)) });
}

export async function listDictations(_request: Request, response: Response): Promise<void> {
  response.json({ data: await admin.listDictations() });
}
export async function createDictation(request: Request, response: Response): Promise<void> {
  response.status(201).json({ data: await admin.createDictation(validBody<DictationBody>(request), actionContext(request)) });
}
export async function patchDictation(request: Request, response: Response): Promise<void> {
  response.json({ data: await admin.updateDictation(idOf(request), validBody<DictationPatch>(request), actionContext(request)) });
}

export async function listRules(_request: Request, response: Response): Promise<void> {
  response.json({ data: await admin.listRules() });
}
export async function createRule(request: Request, response: Response): Promise<void> {
  response.status(201).json({ data: await admin.createRule(validBody<SpellingRuleBody>(request), actionContext(request)) });
}
export async function patchRule(request: Request, response: Response): Promise<void> {
  response.json({ data: await admin.updateRule(idOf(request), validBody<SpellingRulePatch>(request), actionContext(request)) });
}

// Medios: estado de las 6 imágenes del módulo y de los audios de los ejercicios.
export async function listMedia(_request: Request, response: Response): Promise<void> {
  const exercises = await prisma.dictationExercise.findMany({ where: { audioKey: { not: null } }, select: { audioKey: true } });
  const images = await mediaService.listMedia(Object.keys(OFFICE_IMAGES));
  const audios = await mediaService.listMedia([...new Set(exercises.map((item) => item.audioKey!))]);
  response.json({ data: { images: images.map((item) => ({ ...item, alt: OFFICE_IMAGES[item.key]?.alt })), audios } });
}

export async function uploadMedia(request: Request, response: Response): Promise<void> {
  const { key } = request.params as { key: string };
  const reason = typeof request.query.reason === 'string' ? request.query.reason.slice(0, 500) : undefined;
  response.status(201).json({ data: await mediaService.uploadMedia(key, request.body, actionContext(request), reason) });
}

export async function advisorOffice(request: Request, response: Response): Promise<void> {
  response.json({ data: await admin.advisorOffice(idOf(request)) });
}
