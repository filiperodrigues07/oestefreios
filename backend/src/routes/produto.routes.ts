import { Router } from 'express';
import { getProdutoByCodigoHandler, searchProdutosHandler } from '../controllers/produto.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { produtoCodigoParamSchema, produtoSearchQuerySchema } from '../validators/produto.validator.js';

export const produtoRouter = Router();

produtoRouter.use(authenticate, requirePermission('PRODUCT_VIEW'));

produtoRouter.get('/', validate(produtoSearchQuerySchema, 'query'), asyncHandler(searchProdutosHandler));
produtoRouter.get(
  '/:codigo',
  validate(produtoCodigoParamSchema, 'params'),
  asyncHandler(getProdutoByCodigoHandler),
);
