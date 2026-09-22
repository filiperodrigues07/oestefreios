import { Router } from 'express';
import { getProdutoByCodigoHandler, listarTiposProdutosHandler, searchProdutosHandler } from '../controllers/produto.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { codigoParamSchema, searchQuerySchema } from '../validators/search.validator.js';

export const produtoRouter = Router();

produtoRouter.use(authenticate, requirePermission('PRODUCT_VIEW'));

produtoRouter.get('/', validate(searchQuerySchema, 'query'), asyncHandler(searchProdutosHandler));
produtoRouter.get('/tipos', asyncHandler(listarTiposProdutosHandler));
produtoRouter.get('/:codigo', validate(codigoParamSchema, 'params'), asyncHandler(getProdutoByCodigoHandler));
