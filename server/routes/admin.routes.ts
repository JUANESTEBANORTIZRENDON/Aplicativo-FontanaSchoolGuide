import { Router } from 'express';
import * as training from '../controllers/admin-training.controller.js';
import * as users from '../controllers/admin-users.controller.js';
import { Role } from '../domain/enums.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as officeAdmin from '../controllers/admin-office.controller.js';
import { adminOfficeRouter } from './admin-office.routes.js';
import {
  attemptLimitBody, attemptLimitParams, auditQuery, catalogStatusBody, evaluationBody, metricsQuery, moduleMetricsParams, reactivateBody, reactivateParams, reasonBody,
} from '../validators/admin.validator.js';
import { idParams } from '../validators/common.js';
import {
  changeStatusBody, createUserBody, legacyCreateBody, legacyListQuery, legacyUpdateBody, listUsersQuery, resetPasswordBody, setPasswordBody, updateUserBody,
} from '../validators/user.validator.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole(Role.ADMIN));

// Usuarios
adminRouter.get('/users', validate({ query: listUsersQuery }), users.listUsers);
adminRouter.post('/users', validate({ body: createUserBody }), users.createUser);
adminRouter.patch('/users/:id', validate({ params: idParams, body: updateUserBody }), users.updateUser);
adminRouter.patch('/users/:id/status', validate({ params: idParams, body: changeStatusBody }), users.changeStatus);
adminRouter.post('/users/:id/reset-password', validate({ params: idParams, body: resetPasswordBody }), users.resetPassword);
adminRouter.post('/users/:id/reset-course', validate({ params: idParams, body: reasonBody }), users.resetCourse);
adminRouter.put('/users/:id/password', validate({ params: idParams, body: setPasswordBody }), users.setPassword);
adminRouter.get('/advisors/:id/progress', validate({ params: idParams }), training.advisorProgress);
adminRouter.get('/advisors/:id/office', validate({ params: idParams }), officeAdmin.advisorOffice);

// Módulo Ofimática: configuración versionada, contenido, medios
adminRouter.use('/training/office', adminOfficeRouter);

// Catálogo
adminRouter.get('/modules', training.listModules);
adminRouter.patch('/modules/:id/status', validate({ params: idParams, body: catalogStatusBody }), training.setModuleStatus);
adminRouter.patch('/activities/:id/status', validate({ params: idParams, body: catalogStatusBody }), training.setActivityStatus);
adminRouter.post('/activities/:id/evaluations', validate({ params: idParams, body: evaluationBody }), training.createEvaluation);

// Excepciones individuales
adminRouter.post('/advisors/:userId/activities/:activityId/reactivate', validate({ params: reactivateParams, body: reactivateBody }), training.reactivate);
adminRouter.put('/advisors/:userId/activities/:activityId/attempt-limit', validate({ params: attemptLimitParams, body: attemptLimitBody }), training.setAttemptLimit);
adminRouter.post('/overrides/:id/revoke', validate({ params: idParams, body: reasonBody }), training.revokeOverride);

// Certificados: solo anular y reemitir (la emisión automática depende de CERTIFICATES_ENABLED).
adminRouter.post('/certificates/:id/revoke', validate({ params: idParams, body: reasonBody }), training.revokeCertificate);
adminRouter.post('/certificates/:id/reissue', validate({ params: idParams, body: reasonBody }), training.reissueCertificate);

// Métricas y auditoría
adminRouter.get('/metrics/summary', validate({ query: metricsQuery }), training.metricsSummary);
adminRouter.get('/metrics/location', validate({ query: metricsQuery }), training.metricsLocation);
adminRouter.get('/metrics/modules/:moduleId', validate({ params: moduleMetricsParams, query: metricsQuery }), training.moduleMetrics);
adminRouter.get('/audit', validate({ query: auditQuery }), training.audit);

/** @deprecated Alias de la ruta anterior; usan los mismos servicios. Se retiran cuando ningún cliente las llame. */
adminRouter.get('/asesores', validate({ query: legacyListQuery }), users.legacyList);
/** @deprecated */
adminRouter.post('/asesores', validate({ body: legacyCreateBody }), users.legacyCreate);
/** @deprecated */
adminRouter.put('/asesores/:id', validate({ params: idParams, body: legacyUpdateBody }), users.legacyUpdate);
/** @deprecated */
adminRouter.delete('/asesores/:id', validate({ params: idParams }), users.legacyDeactivate);
