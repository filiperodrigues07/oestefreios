import { Router } from 'express';
import { getClienteByCodigoHandler, searchClientesHandler } from '../controllers/cliente.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { codigoParamSchema, searchQuerySchema } from '../validators/search.validator.js';

export const clienteRouter = Router();

// Sem dado financeiro no cliente — só exige sessão válida, sem permissão granular específica.
clienteRouter.use(authenticate);

clienteRouter.get('/', validate(searchQuerySchema, 'query'), asyncHandler(searchClientesHandler));
clienteRouter.get('/:codigo', validate(codigoParamSchema, 'params'), asyncHandler(getClienteByCodigoHandler));
