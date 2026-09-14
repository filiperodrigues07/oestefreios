import { Router } from 'express';
import {
  adicionarProdutoHandler,
  adicionarServicoHandler,
  alterarStatusHandler,
  atualizarOSHandler,
  criarOSHandler,
  getOSByIdHandler,
  listOSHandler,
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
  atualizarOSSchema,
  criarOSSchema,
  listarOSQuerySchema,
  osIdParamSchema,
  osItemProdutoParamSchema,
  osItemServicoParamSchema,
} from '../validators/os.validator.js';

export const osRouter = Router();

osRouter.use(authenticate, requirePermission('OS_VIEW'));

osRouter.get('/', validate(listarOSQuerySchema, 'query'), asyncHandler(listOSHandler));
osRouter.get('/:id', validate(osIdParamSchema, 'params'), asyncHandler(getOSByIdHandler));

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
