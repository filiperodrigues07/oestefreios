import { Router } from 'express';
import {
  atualizarEquipamentoHandler,
  criarEquipamentoHandler,
  getEquipamentoByCodigoHandler,
  searchEquipamentosHandler,
} from '../controllers/equipamento.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { equipamentoInputSchema } from '../validators/equipamento.validator.js';
import { codigoParamSchema, searchQuerySchema } from '../validators/search.validator.js';
import { getVehicleLookupQuotaHandler, lookupVehiclePlateHandler } from '../controllers/vehicleLookup.controller.js';
import { vehicleLookupSchema } from '../validators/vehicleLookup.validator.js';

export const equipamentoRouter = Router();

equipamentoRouter.use(authenticate);

equipamentoRouter.get('/', validate(searchQuerySchema, 'query'), asyncHandler(searchEquipamentosHandler));
equipamentoRouter.get('/lookup/quota', requirePermission('OS_CREATE'), asyncHandler(getVehicleLookupQuotaHandler));
equipamentoRouter.post('/lookup', requirePermission('OS_CREATE'), validate(vehicleLookupSchema), asyncHandler(lookupVehiclePlateHandler));
equipamentoRouter.get('/:codigo', validate(codigoParamSchema, 'params'), asyncHandler(getEquipamentoByCodigoHandler));

equipamentoRouter.post(
  '/',
  requirePermission('OS_CREATE'),
  validate(equipamentoInputSchema),
  asyncHandler(criarEquipamentoHandler),
);
equipamentoRouter.put(
  '/:codigo',
  requirePermission('OS_EDIT'),
  validate(codigoParamSchema, 'params'),
  validate(equipamentoInputSchema),
  asyncHandler(atualizarEquipamentoHandler),
);
