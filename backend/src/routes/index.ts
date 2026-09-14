import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { clienteRouter } from './cliente.routes.js';
import { equipamentoRouter } from './equipamento.routes.js';
import { healthRouter } from './health.routes.js';
import { osRouter } from './os.routes.js';
import { produtoRouter } from './produto.routes.js';
import { servicoRouter } from './servico.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/produtos', produtoRouter);
apiRouter.use('/servicos', servicoRouter);
apiRouter.use('/clientes', clienteRouter);
apiRouter.use('/equipamentos', equipamentoRouter);
apiRouter.use('/os', osRouter);
