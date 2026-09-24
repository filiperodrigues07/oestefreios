import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { resolve } from 'node:path';
import helmet from 'helmet';
import timeout from 'connect-timeout';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { corsOptions } from './config/cors.config.js';
import { openApiDocument } from './config/swagger.config.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFoundHandler } from './middlewares/notFoundHandler.js';
import { generalLimiter } from './middlewares/rateLimiter.js';
import { apiRouter } from './routes/index.js';
import { logger } from './utils/logger.js';
import { env } from './config/env.js';

export const app = express();

app.use(helmet());
app.use(cors(corsOptions));

// Rede de segurança contra request pendurada (ex.: várias queries Firebird em sequência
// somando mais que o timeout individual de cada uma) — não é o timeout do dia a dia, é o teto.
app.use(timeout('30s'));

app.use('/api/auth/me/photo', express.json({ limit: '1500kb' }));
app.use('/api/settings/geral', express.json({ limit: '1500kb' }));
app.use(express.json());
app.use(cookieParser());
app.use(generalLimiter);

// Middleware de connect-timeout só marca req.timedout — cada handler downstream que ainda não
// tenha respondido precisa checar isso antes de continuar processando (ex.: antes de tocar no banco).
app.use((req, _res, next) => {
  if (!req.timedout) next();
});

app.use((req, _res, next) => {
  req.requestId = randomUUID();
  next();
});

app.use(pinoHttp({ logger, genReqId: (req: express.Request) => req.requestId ?? randomUUID() }));

app.use('/api/uploads', express.static(resolve(process.cwd(), 'uploads'), { fallthrough: false, maxAge: '7d' }));

if (env.NODE_ENV !== 'production') {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
}

// Respostas da API podem conter dados de clientes; não deixar o cache HTTP do navegador persistir.
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
