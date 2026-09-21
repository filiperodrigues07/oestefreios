import { Router } from 'express';
import {
  atualizarClienteHandler,
  consultarCepHandler,
  consultarCnpjHandler,
  criarClienteHandler,
  getClienteByCodigoHandler,
  searchClientesHandler,
} from '../controllers/cliente.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { cepParamSchema, clienteCreateSchema, clienteInputSchema, cnpjParamSchema } from '../validators/cliente.validator.js';
import { codigoParamSchema, searchQuerySchema } from '../validators/search.validator.js';

export const clienteRouter = Router();

// Sem dado financeiro no cliente — só exige sessão válida, sem permissão granular específica pra consulta.
clienteRouter.use(authenticate);

clienteRouter.get('/', validate(searchQuerySchema, 'query'), asyncHandler(searchClientesHandler));
clienteRouter.get('/cnpj/:cnpj', validate(cnpjParamSchema, 'params'), asyncHandler(consultarCnpjHandler));
clienteRouter.get('/cep/:cep', validate(cepParamSchema, 'params'), asyncHandler(consultarCepHandler));
clienteRouter.get('/:codigo', validate(codigoParamSchema, 'params'), asyncHandler(getClienteByCodigoHandler));

// Cadastrar/editar cliente é parte do mesmo fluxo de quem cria/edita OS — reaproveita a permissão existente.
clienteRouter.post('/', requirePermission('OS_CREATE'), validate(clienteCreateSchema), asyncHandler(criarClienteHandler));
clienteRouter.put(
  '/:codigo',
  requirePermission('OS_EDIT'),
  validate(codigoParamSchema, 'params'),
  validate(clienteInputSchema),
  asyncHandler(atualizarClienteHandler),
);
