import { Router } from 'express';
import { listAuditLogsHandler } from '../controllers/auditLog.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listarAuditLogsQuerySchema } from '../validators/auditLog.validator.js';

export const auditLogRouter = Router();

// Trilha de auditoria é dado sensível de segurança — restrita a SYSTEM_SETTINGS (só Administrador no seed).
auditLogRouter.use(authenticate, requirePermission('SYSTEM_SETTINGS'));

auditLogRouter.get('/', validate(listarAuditLogsQuerySchema, 'query'), asyncHandler(listAuditLogsHandler));
