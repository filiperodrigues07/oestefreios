import { extendZodWithOpenApi, OpenApiGeneratorV3, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { loginSchema } from '../validators/auth.validator.js';
import { produtoSearchQuerySchema } from '../validators/produto.validator.js';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

registry.registerPath({
  method: 'get',
  path: '/api/health',
  summary: 'Verifica a saúde do backend e do Postgres.',
  responses: {
    200: { description: 'Serviço saudável.' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/login',
  summary: 'Autentica usuário e retorna access token (refresh token vai em cookie httpOnly).',
  request: {
    body: { content: { 'application/json': { schema: loginSchema } } },
  },
  responses: {
    200: { description: 'Login bem-sucedido.' },
    401: { description: 'Credenciais inválidas.' },
    429: { description: 'Muitas tentativas de login.' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/refresh',
  summary: 'Rotaciona o refresh token (via cookie) e emite novo access token.',
  responses: {
    200: { description: 'Token renovado.' },
    401: { description: 'Sessão expirada ou token reutilizado.' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/logout',
  summary: 'Revoga o refresh token atual.',
  responses: { 200: { description: 'Logout realizado.' } },
});

registry.registerPath({
  method: 'get',
  path: '/api/auth/me',
  summary: 'Retorna o usuário autenticado atual.',
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: 'Usuário atual.' }, 401: { description: 'Não autenticado.' } },
});

registry.registerPath({
  method: 'get',
  path: '/api/produtos',
  summary: 'Busca produtos do CHERP por código ou descrição (mock nas Fases 1-4).',
  security: [{ bearerAuth: [] }],
  request: {
    query: produtoSearchQuerySchema,
  },
  responses: {
    200: { description: 'Lista paginada de produtos (campos financeiros só com FINANCIAL_VIEW).' },
    403: { description: 'Sem permissão PRODUCT_VIEW.' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/os',
  summary: 'Lista Ordens de Serviço (mock nas Fases 1-4).',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'Lista de OS (campos financeiros só com FINANCIAL_VIEW).' },
    403: { description: 'Sem permissão OS_VIEW.' },
  },
});

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

const generator = new OpenApiGeneratorV3(registry.definitions);

export const openApiDocument = generator.generateDocument({
  openapi: '3.0.0',
  info: {
    title: 'Oeste Freios — OS API',
    version: '0.1.0',
    description: 'API de controle de Ordens de Serviço integrada ao CHERP/Firebird.',
  },
  servers: [{ url: '/api', description: 'API base' }],
});
