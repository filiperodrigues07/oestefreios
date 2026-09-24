import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  addPaymentHandler,
  createCobrancaHandler,
  downloadCobrancaHandler,
  getCobrancaConfigHandler,
  getCobrancaSmtpPasswordHandler,
  removeCobrancaHandler,
  saveCobrancaConfigHandler,
  sendCobrancaHandler,
  testCobrancaSmtpHandler,
  controlBillingHandler,
  getBillingHandler,
  getBillingStatusHandler,
  removePaymentHandler,
  updateBillingHandler,
} from '../controllers/billing.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireSuperAdmin } from '../middlewares/requireSuperAdmin.js';
import { validate } from '../middlewares/validate.js';
import { billingUpdateSchema, cobrancaConfigSchema, controleAssinaturaSchema, enviarCobrancaSchema, novaCobrancaSchema, novoPagamentoSchema, testeCobrancaSchema } from '../validators/billing.validator.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// PDF em memória (até 5 MB) — validado por assinatura (%PDF-) no service e gravado em storage/ privado.
const uploadPdf = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

export const billingRouter = Router();
billingRouter.use(authenticate);
billingRouter.get('/status', asyncHandler(getBillingStatusHandler));
billingRouter.use(requireSuperAdmin);
billingRouter.get('/', asyncHandler(getBillingHandler));
billingRouter.put('/', validate(billingUpdateSchema), asyncHandler(updateBillingHandler));
billingRouter.post('/controle', validate(controleAssinaturaSchema), asyncHandler(controlBillingHandler));
billingRouter.post('/pagamentos', validate(novoPagamentoSchema), asyncHandler(addPaymentHandler));
billingRouter.delete('/pagamentos/:id', validate(z.object({ id: z.string().uuid() }), 'params'), asyncHandler(removePaymentHandler));

const idParam = validate(z.object({ id: z.string().uuid() }), 'params');
billingRouter.post('/cobrancas', uploadPdf.single('arquivo'), validate(novaCobrancaSchema), asyncHandler(createCobrancaHandler));
billingRouter.get('/cobrancas/:id/arquivo', idParam, asyncHandler(downloadCobrancaHandler));
billingRouter.post('/cobrancas/:id/enviar', idParam, validate(enviarCobrancaSchema), asyncHandler(sendCobrancaHandler));
billingRouter.delete('/cobrancas/:id', idParam, asyncHandler(removeCobrancaHandler));
billingRouter.get('/cobranca-config', asyncHandler(getCobrancaConfigHandler));
billingRouter.put('/cobranca-config', validate(cobrancaConfigSchema), asyncHandler(saveCobrancaConfigHandler));
billingRouter.get('/cobranca-config/senha', asyncHandler(getCobrancaSmtpPasswordHandler));
billingRouter.post('/cobranca-config/testar', validate(testeCobrancaSchema), asyncHandler(testCobrancaSmtpHandler));
