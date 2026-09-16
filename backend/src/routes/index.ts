import { Router } from 'express';
import { auditLogRouter } from './auditLog.routes.js';
import { authRouter } from './auth.routes.js';
import { clienteRouter } from './cliente.routes.js';
import { dashboardRouter } from './dashboard.routes.js';
import { equipamentoRouter } from './equipamento.routes.js';
import { healthRouter } from './health.routes.js';
import { osRouter } from './os.routes.js';
import { produtoRouter } from './produto.routes.js';
import { servicoRouter } from './servico.routes.js';
import { settingsRouter } from './settings.routes.js';
import { userRouter } from './user.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/produtos', produtoRouter);
apiRouter.use('/servicos', servicoRouter);
apiRouter.use('/clientes', clienteRouter);
apiRouter.use('/equipamentos', equipamentoRouter);
apiRouter.use('/os', osRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/audit-logs', auditLogRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/usuarios', userRouter);
