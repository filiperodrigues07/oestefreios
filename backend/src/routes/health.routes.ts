import { Router } from 'express';
import { healthHandler } from '../controllers/health.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const healthRouter = Router();

healthRouter.get('/', asyncHandler(healthHandler));
