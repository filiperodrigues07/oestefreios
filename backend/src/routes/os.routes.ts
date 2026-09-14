import { Router } from 'express';
import { getOSByIdHandler, listOSHandler } from '../controllers/os.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const osRouter = Router();

osRouter.use(authenticate, requirePermission('OS_VIEW'));

osRouter.get('/', asyncHandler(listOSHandler));
osRouter.get('/:id', asyncHandler(getOSByIdHandler));
