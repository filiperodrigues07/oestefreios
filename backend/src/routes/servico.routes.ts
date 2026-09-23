import { Router } from 'express';
import { getServicoByCodigoHandler, listarTiposServicosHandler, searchServicosHandler } from '../controllers/servico.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { codigoParamSchema, searchQuerySchema } from '../validators/search.validator.js';

export const servicoRouter = Router();

servicoRouter.use(authenticate, requirePermission('SERVICE_VIEW'));

servicoRouter.get('/', validate(searchQuerySchema, 'query'), asyncHandler(searchServicosHandler));
servicoRouter.get('/tipos', asyncHandler(listarTiposServicosHandler));
servicoRouter.get('/:codigo', validate(codigoParamSchema, 'params'), asyncHandler(getServicoByCodigoHandler));
