import { Router } from 'express';
import { z } from 'zod';
import {
  addPaymentHandler,
  controlBillingHandler,
  getBillingHandler,
  getBillingStatusHandler,
  removePaymentHandler,
  updateBillingHandler,
} from '../controllers/billing.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireSuperAdmin } from '../middlewares/requireSuperAdmin.js';
import { validate } from '../middlewares/validate.js';
import { billingUpdateSchema, controleAssinaturaSchema, novoPagamentoSchema } from '../validators/billing.validator.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const billingRouter = Router();
billingRouter.use(authenticate);
billingRouter.get('/status', asyncHandler(getBillingStatusHandler));
billingRouter.use(requireSuperAdmin);
billingRouter.get('/', asyncHandler(getBillingHandler));
billingRouter.put('/', validate(billingUpdateSchema), asyncHandler(updateBillingHandler));
billingRouter.post('/controle', validate(controleAssinaturaSchema), asyncHandler(controlBillingHandler));
billingRouter.post('/pagamentos', validate(novoPagamentoSchema), asyncHandler(addPaymentHandler));
billingRouter.delete('/pagamentos/:id', validate(z.object({ id: z.string().uuid() }), 'params'), asyncHandler(removePaymentHandler));
