import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { healthRouter } from './health.routes.js';
import { osRouter } from './os.routes.js';
import { produtoRouter } from './produto.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/produtos', produtoRouter);
apiRouter.use('/os', osRouter);
