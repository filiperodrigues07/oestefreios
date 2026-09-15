import { extendZodWithOpenApi, OpenApiGeneratorV3, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { loginSchema } from '../validators/auth.validator.js';
import {
  adicionarProdutoSchema,
  adicionarServicoSchema,
  alterarStatusSchema,
  atualizarOSSchema,
  criarOSSchema,
} from '../validators/os.validator.js';
import { searchQuerySchema } from '../validators/search.validator.js';

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
    query: searchQuerySchema,
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

registry.registerPath({
  method: 'post',
  path: '/api/os',
  summary: 'Cria uma nova OS (status inicial ABERTA).',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: criarOSSchema } } } },
  responses: {
    201: { description: 'OS criada.' },
    400: { description: 'Cliente/equipamento inválido ou não pertence ao cliente.' },
    403: { description: 'Sem permissão OS_CREATE.' },
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/os/{id}',
  summary: 'Atualiza campos editáveis da OS (diagnóstico, observações, solução, prioridade, responsável, técnico).',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: atualizarOSSchema } } } },
  responses: { 200: { description: 'Alterações salvas.' }, 403: { description: 'Sem permissão OS_EDIT.' } },
});

registry.registerPath({
  method: 'patch',
  path: '/api/os/{id}/status',
  summary: 'Altera o status da OS. Transição validada no backend (seção 17).',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: alterarStatusSchema } } } },
  responses: {
    200: { description: 'Status alterado.' },
    400: { description: 'Transição de status inválida.' },
    403: { description: 'Sem permissão OS_CHANGE_STATUS.' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/os/{id}/produtos',
  summary: 'Adiciona um produto à OS.',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: adicionarProdutoSchema } } } },
  responses: { 200: { description: 'Produto adicionado.' }, 403: { description: 'Sem permissão PRODUCT_ADD_TO_OS.' } },
});

registry.registerPath({
  method: 'delete',
  path: '/api/os/{id}/produtos/{produtoCodigo}',
  summary: 'Remove um produto da OS.',
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: 'Produto removido.' } },
});

registry.registerPath({
  method: 'post',
  path: '/api/os/{id}/servicos',
  summary: 'Adiciona um serviço à OS.',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: adicionarServicoSchema } } } },
  responses: { 200: { description: 'Serviço adicionado.' }, 403: { description: 'Sem permissão SERVICE_ADD_TO_OS.' } },
});

registry.registerPath({
  method: 'delete',
  path: '/api/os/{id}/servicos/{servicoCodigo}',
  summary: 'Remove um serviço da OS.',
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: 'Serviço removido.' } },
});

registry.registerPath({
  method: 'get',
  path: '/api/servicos',
  summary: 'Busca serviços do CHERP por código ou descrição (mock nas Fases 1-4).',
  security: [{ bearerAuth: [] }],
  request: { query: searchQuerySchema },
  responses: { 200: { description: 'Lista paginada (valor só com FINANCIAL_VIEW).' } },
});

registry.registerPath({
  method: 'get',
  path: '/api/clientes',
  summary: 'Busca clientes do CHERP por código ou nome (mock nas Fases 1-4).',
  security: [{ bearerAuth: [] }],
  request: { query: searchQuerySchema },
  responses: { 200: { description: 'Lista paginada de clientes.' } },
});

registry.registerPath({
  method: 'get',
  path: '/api/equipamentos',
  summary: 'Busca equipamentos do CHERP por código/descrição, opcionalmente filtrado por cliente (mock nas Fases 1-4).',
  security: [{ bearerAuth: [] }],
  request: { query: searchQuerySchema },
  responses: { 200: { description: 'Lista paginada de equipamentos.' } },
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
