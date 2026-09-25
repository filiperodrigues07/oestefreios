import { Router } from 'express';
import {
  relatorioCatalogoProdutosHandler,
  relatorioCatalogoServicosHandler,
  relatorioClientesHandler,
  relatorioOSHandler,
  relatorioProdutosServicosHandler,
  relatorioVeiculosHandler,
} from '../controllers/relatorio.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { exportLimiter } from '../middlewares/rateLimiter.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  relatorioCatalogoQuerySchema,
  relatorioClientesQuerySchema,
  relatorioOSQuerySchema,
  relatorioProdutosServicosQuerySchema,
  relatorioVeiculosQuerySchema,
} from '../validators/relatorio.validator.js';

export const relatorioRouter = Router();

relatorioRouter.use(authenticate, exportLimiter);

// Exportação do que já está na tela (OS/Clientes) — mesma permissão que já libera ver a tela,
// não é um "relatório gerencial" à parte. Financeiro continua atrás de FINANCIAL_VIEW dentro do service.
relatorioRouter.get('/os', requirePermission('OS_VIEW'), validate(relatorioOSQuerySchema, 'query'), asyncHandler(relatorioOSHandler));
relatorioRouter.get(
  '/clientes',
  requirePermission('OS_VIEW'),
  validate(relatorioClientesQuerySchema, 'query'),
  asyncHandler(relatorioClientesHandler),
);
relatorioRouter.get(
  '/veiculos',
  requirePermission('OS_VIEW'),
  validate(relatorioVeiculosQuerySchema, 'query'),
  asyncHandler(relatorioVeiculosHandler),
);
relatorioRouter.get(
  '/catalogo/produtos',
  requirePermission('PRODUCT_VIEW'),
  validate(relatorioCatalogoQuerySchema, 'query'),
  asyncHandler(relatorioCatalogoProdutosHandler),
);
relatorioRouter.get(
  '/catalogo/servicos',
  requirePermission('SERVICE_VIEW'),
  validate(relatorioCatalogoQuerySchema, 'query'),
  asyncHandler(relatorioCatalogoServicosHandler),
);

// Ranking de vendas por período — insight gerencial de verdade, continua exigindo REPORT_VIEW.
relatorioRouter.get(
  '/produtos-servicos',
  requirePermission('REPORT_VIEW'),
  validate(relatorioProdutosServicosQuerySchema, 'query'),
  asyncHandler(relatorioProdutosServicosHandler),
);
