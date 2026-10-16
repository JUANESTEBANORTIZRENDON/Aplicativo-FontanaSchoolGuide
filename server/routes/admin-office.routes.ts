import express, { Router } from 'express';
import * as office from '../controllers/admin-office.controller.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../validators/common.js';
import {
  dictationBody, dictationPatch, excelActivityBody, excelActivityPatch, keyParams, officeConfigBody, spellingRuleBody, spellingRulePatch,
  typingTextBody, typingTextPatch,
} from '../validators/office.validator.js';

// /api/admin/training/office (el router padre ya exige administrador).
export const adminOfficeRouter = Router();

adminOfficeRouter.get('/config', office.getConfig);
adminOfficeRouter.patch('/config', validate({ body: officeConfigBody }), office.patchConfig);

adminOfficeRouter.get('/texts', office.listTexts);
adminOfficeRouter.post('/texts', validate({ body: typingTextBody }), office.createText);
adminOfficeRouter.patch('/texts/:id', validate({ params: idParams, body: typingTextPatch }), office.patchText);

adminOfficeRouter.get('/excel-activities', office.listExcel);
adminOfficeRouter.post('/excel-activities', validate({ body: excelActivityBody }), office.createExcel);
adminOfficeRouter.patch('/excel-activities/:id', validate({ params: idParams, body: excelActivityPatch }), office.patchExcel);

adminOfficeRouter.get('/dictations', office.listDictations);
adminOfficeRouter.post('/dictations', validate({ body: dictationBody }), office.createDictation);
adminOfficeRouter.patch('/dictations/:id', validate({ params: idParams, body: dictationPatch }), office.patchDictation);

adminOfficeRouter.get('/rules', office.listRules);
adminOfficeRouter.post('/rules', validate({ body: spellingRuleBody }), office.createRule);
adminOfficeRouter.patch('/rules/:id', validate({ params: idParams, body: spellingRulePatch }), office.patchRule);

adminOfficeRouter.get('/media', office.listMedia);
// express.raw solo en esta ruta: WebP de hasta 1 MB y audio OGG o MP3 de hasta 2 MB.
adminOfficeRouter.put('/media/:key', validate({ params: keyParams }), express.raw({ type: () => true, limit: '2mb' }), office.uploadMedia);
