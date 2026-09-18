import { Router } from 'express';
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
  getOSByIdHandler,
  getOSPdfHandler,
  listarImagensHandler,
  listOSHandler,
  removerImagemHandler,
  removerProdutoHandler,
  removerServicoHandler,
} from '../controllers/os.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  adicionarProdutoSchema,
  adicionarServicoSchema,
  alterarStatusSchema,
  atualizarItemSchema,
  atualizarOSSchema,
  criarOSSchema,
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
osRouter.get('/:id/pdf', validate(osIdParamSchema, 'params'), asyncHandler(getOSPdfHandler));

osRouter.post('/', requirePermission('OS_CREATE'), validate(criarOSSchema), asyncHandler(criarOSHandler));

osRouter.put(
  '/:id',
  requirePermission('OS_EDIT'),
  validate(osIdParamSchema, 'params'),
  validate(atualizarOSSchema),
  asyncHandler(atualizarOSHandler),
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

osRouter.patch(
  '/:id/produtos/:produtoCodigo',
  requirePermission('PRODUCT_ADD_TO_OS'),
  validate(osItemProdutoParamSchema, 'params'),
  validate(atualizarItemSchema),
  asyncHandler(atualizarProdutoItemHandler),
);

osRouter.post(
  '/:id/servicos',
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
