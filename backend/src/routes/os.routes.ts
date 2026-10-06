import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import {
  adicionarImagemHandler,
  adicionarProdutoHandler,
  adicionarServicoHandler,
  alterarStatusHandler,
  atualizarOSHandler,
  atualizarProdutoItemHandler,
  atualizarServicoItemHandler,
  buscarImagemHandler,
  criarOSHandler,
  duplicarOSHandler,
  excluirOSHandler,
  reabrirOSHandler,
  getOSByIdHandler,
  getOSPdfHandler,
  listarImagensHandler,
  listOSHandler,
  removerImagemHandler,
  removerProdutoHandler,
  removerServicoHandler,
  restaurarProdutoHandler,
  restaurarServicoHandler,
  trocarVinculoOSHandler,
} from '../controllers/os.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { idempotency } from '../middlewares/idempotency.js';
import { exportLimiter, osMessageLimiter } from '../middlewares/rateLimiter.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import { getOsMessagePreview, listOsMessageHistory, revokeOsWhatsappConsent, sendManualOsMessage } from '../services/osCommunication.service.js';
import { requestContext } from '../utils/requestContext.js';
import {
  adicionarProdutoSchema,
  adicionarServicoSchema,
  alterarStatusSchema,
  atualizarItemSchema,
  atualizarOSSchema,
  trocarVinculoOSSchema,
  criarOSSchema,
  duplicarOSSchema,
  excluirOSSchema,
  reabrirOSSchema,
  listarOSQuerySchema,
  osIdParamSchema,
  osImagemParamSchema,
  osItemProdutoParamSchema,
  osItemServicoParamSchema,
} from '../validators/os.validator.js';

// Memória, não disco — a imagem vai direto pro BLOB do Firebird (ORDEMSERVICOIMG), nunca fica em arquivo local.
const uploadImagem = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

export const osRouter = Router();

osRouter.use(authenticate, requirePermission('OS_VIEW'));

osRouter.get('/', validate(listarOSQuerySchema, 'query'), asyncHandler(listOSHandler));
osRouter.get('/:id', validate(osIdParamSchema, 'params'), asyncHandler(getOSByIdHandler));
osRouter.get('/:id/pdf', exportLimiter, validate(osIdParamSchema, 'params'), asyncHandler(getOSPdfHandler));

osRouter.get('/:id/mensagem', validate(osIdParamSchema, 'params'), asyncHandler(async (req, res) => {
  success(res, await getOsMessagePreview(req.params.id as string, req.user!.permissions));
}));
osRouter.get('/:id/mensagem/historico', validate(osIdParamSchema, 'params'), asyncHandler(async (req, res) => {
  success(res, await listOsMessageHistory(req.params.id as string, req.user!.permissions));
}));
osRouter.post('/:id/mensagem/revogar-whatsapp', requirePermission('OS_SEND'), validate(osIdParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await revokeOsWhatsappConsent(req.params.id as string, req.user!, requestContext(req));
    success(res, null, 'Autorização de WhatsApp revogada para este cliente.');
  }));
osRouter.post('/:id/mensagem', osMessageLimiter, idempotency, requirePermission('OS_SEND'), validate(osIdParamSchema, 'params'),
  validate(z.object({ channel: z.enum(['whatsapp', 'email']), type: z.enum(['aberta', 'aguardando_cliente', 'aguardando_peca', 'pronta', 'resumo_financeiro']), consent: z.boolean().default(false), attachPdf: z.boolean().default(false) })),
  asyncHandler(async (req, res) => {
    const { channel, type, consent, attachPdf } = req.body as { channel: 'whatsapp' | 'email'; type: 'aberta' | 'aguardando_cliente' | 'aguardando_peca' | 'pronta' | 'resumo_financeiro'; consent: boolean; attachPdf: boolean };
    success(res, await sendManualOsMessage(req.params.id as string, channel, type, req.user!, consent, requestContext(req), attachPdf), 'Mensagem enviada à integração.');
  }));

osRouter.post('/', idempotency, requirePermission('OS_CREATE'), validate(criarOSSchema), asyncHandler(criarOSHandler));

osRouter.post(
  '/:id/duplicar',
  idempotency,
  requirePermission('OS_CREATE'),
  validate(osIdParamSchema, 'params'),
  validate(duplicarOSSchema),
  asyncHandler(duplicarOSHandler),
);

osRouter.post(
  '/:id/reabrir',
  requirePermission('OS_REOPEN'),
  validate(osIdParamSchema, 'params'),
  validate(reabrirOSSchema),
  asyncHandler(reabrirOSHandler),
);

osRouter.delete(
  '/:id',
  requirePermission('OS_DELETE'),
  validate(osIdParamSchema, 'params'),
  validate(excluirOSSchema),
  asyncHandler(excluirOSHandler),
);

osRouter.put(
  '/:id',
  requirePermission('OS_EDIT'),
  validate(osIdParamSchema, 'params'),
  validate(atualizarOSSchema),
  asyncHandler(atualizarOSHandler),
);

osRouter.patch(
  '/:id/vinculo',
  requirePermission('OS_EDIT'),
  validate(osIdParamSchema, 'params'),
  validate(trocarVinculoOSSchema),
  asyncHandler(trocarVinculoOSHandler),
);

osRouter.patch(
  '/:id/status',
  requirePermission('OS_CHANGE_STATUS'),
  validate(osIdParamSchema, 'params'),
  validate(alterarStatusSchema),
  asyncHandler(alterarStatusHandler),
);

osRouter.post(
  '/:id/produtos',
  idempotency,
  requirePermission('PRODUCT_ADD_TO_OS'),
  validate(osIdParamSchema, 'params'),
  validate(adicionarProdutoSchema),
  asyncHandler(adicionarProdutoHandler),
);

osRouter.delete(
  '/:id/produtos/:produtoCodigo',
  requirePermission('PRODUCT_ADD_TO_OS'),
  validate(osItemProdutoParamSchema, 'params'),
  asyncHandler(removerProdutoHandler),
);

osRouter.post(
  '/:id/produtos/:produtoCodigo/restaurar',
  idempotency,
  requirePermission('PRODUCT_ADD_TO_OS'),
  validate(osItemProdutoParamSchema, 'params'),
  asyncHandler(restaurarProdutoHandler),
);

osRouter.patch(
  '/:id/produtos/:produtoCodigo',
  requirePermission('PRODUCT_ADD_TO_OS'),
  validate(osItemProdutoParamSchema, 'params'),
  validate(atualizarItemSchema),
  asyncHandler(atualizarProdutoItemHandler),
);

osRouter.post(
  '/:id/servicos',
  idempotency,
  requirePermission('SERVICE_ADD_TO_OS'),
  validate(osIdParamSchema, 'params'),
  validate(adicionarServicoSchema),
  asyncHandler(adicionarServicoHandler),
);

osRouter.delete(
  '/:id/servicos/:servicoCodigo',
  requirePermission('SERVICE_ADD_TO_OS'),
  validate(osItemServicoParamSchema, 'params'),
  asyncHandler(removerServicoHandler),
);

osRouter.post(
  '/:id/servicos/:servicoCodigo/restaurar',
  idempotency,
  requirePermission('SERVICE_ADD_TO_OS'),
  validate(osItemServicoParamSchema, 'params'),
  asyncHandler(restaurarServicoHandler),
);

osRouter.patch(
  '/:id/servicos/:servicoCodigo',
  requirePermission('SERVICE_ADD_TO_OS'),
  validate(osItemServicoParamSchema, 'params'),
  validate(atualizarItemSchema),
  asyncHandler(atualizarServicoItemHandler),
);

osRouter.get('/:id/imagens', validate(osIdParamSchema, 'params'), asyncHandler(listarImagensHandler));

osRouter.post(
  '/:id/imagens',
  requirePermission('OS_EDIT'),
  validate(osIdParamSchema, 'params'),
  uploadImagem.single('imagem'),
  asyncHandler(adicionarImagemHandler),
);

osRouter.get(
  '/:id/imagens/:identificador',
  validate(osImagemParamSchema, 'params'),
  asyncHandler(buscarImagemHandler),
);

osRouter.delete(
  '/:id/imagens/:identificador',
  requirePermission('OS_EDIT'),
  validate(osImagemParamSchema, 'params'),
  asyncHandler(removerImagemHandler),
);
