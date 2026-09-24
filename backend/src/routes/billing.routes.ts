import { Router } from 'express';
import { z } from 'zod';
import {
  addPaymentHandler,
  getBillingHandler,
  getBillingStatusHandler,
  removePaymentHandler,
  updateBillingHandler,
} from '../controllers/billing.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { validate } from '../middlewares/validate.js';
import { billingUpdateSchema, novoPagamentoSchema } from '../validators/billing.validator.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const billingRouter = Router();
billingRouter.use(authenticate);
billingRouter.get('/status', asyncHandler(getBillingStatusHandler));
billingRouter.use(requirePermission('SYSTEM_SETTINGS'));
billingRouter.get('/', asyncHandler(getBillingHandler));
billingRouter.put('/', validate(billingUpdateSchema), asyncHandler(updateBillingHandler));
billingRouter.post('/pagamentos', validate(novoPagamentoSchema), asyncHandler(addPaymentHandler));
billingRouter.delete('/pagamentos/:id', validate(z.object({ id: z.string().uuid() }), 'params'), asyncHandler(removePaymentHandler));
