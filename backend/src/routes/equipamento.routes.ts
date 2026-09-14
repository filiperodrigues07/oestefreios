import { Router } from 'express';
import { getEquipamentoByCodigoHandler, searchEquipamentosHandler } from '../controllers/equipamento.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { codigoParamSchema, searchQuerySchema } from '../validators/search.validator.js';

export const equipamentoRouter = Router();

equipamentoRouter.use(authenticate);

equipamentoRouter.get('/', validate(searchQuerySchema, 'query'), asyncHandler(searchEquipamentosHandler));
equipamentoRouter.get('/:codigo', validate(codigoParamSchema, 'params'), asyncHandler(getEquipamentoByCodigoHandler));
