# Oeste Freios — Controle de OS

Sistema PWA de controle de Ordens de Serviço, integrado ao ERP Firebird (CHERP). Monorepo com backend (Express/TypeScript, arquitetura em camadas) e frontend (Vite/React/TypeScript, PWA).

Status: **Fase 1 (Fundação), Fase 2 (Autenticação), Fase 3 (Design System) e Fase 4 (Ordens de Serviço)** concluídas e testadas. Ver "Roadmap" no fim deste README para as próximas fases.

## Stack

- **Backend**: Node.js, TypeScript, Express, Zod, JWT + refresh token rotativo, Argon2id, Pino, Helmet, Drizzle ORM (Postgres), Swagger/OpenAPI.
- **Frontend**: React, TypeScript, Vite, React Router, Zustand, TanStack Query, PWA (vite-plugin-pwa), design tokens CSS com tema claro/escuro.
- **Banco da aplicação**: PostgreSQL (usuários, perfis, permissões, refresh tokens, auditoria).
- **CHERP/Firebird**: repositórios com interface pronta, implementação **mock** em memória até a Fase 5 (queries reais ainda não fornecidas).

## Pré-requisitos

- Node.js 22+ e npm.
- PostgreSQL rodando localmente (ou acessível via `DATABASE_URL`).

## Setup

```bash
npm install

# copie e ajuste o .env do backend
cp backend/.env.example backend/.env

# crie o banco (ajuste nome/credenciais conforme o .env)
# ex.: psql -U postgres -c "CREATE DATABASE oeste_freios;"

# aplique o schema e o seed
npm run db:generate -w backend   # já versionado em backend/src/database/migrations, só rode de novo se alterar o schema
npm run db:migrate -w backend
npm run db:seed -w backend
```

O seed cria 5 perfis (Administrador, Mecânico, Supervisor, Atendente, Gerente) e dois usuários de desenvolvimento:

| Perfil | E-mail | Senha | Vê valores financeiros? |
|---|---|---|---|
| Administrador | `admin@dev.local` | `Admin@123456` | Sim |
| Mecânico | `mecanico@dev.local` | `Mecanico@123456` | **Não** |

Credenciais só para desenvolvimento local — nunca usar em produção.

## Rodando

```bash
npm run dev        # backend (porta 3000) + frontend (porta 5173) em paralelo
```

- API: http://localhost:3000/api
- Swagger: http://localhost:3000/api/docs
- Frontend: http://localhost:5173

## Verificação

```bash
npm run lint
npm run typecheck
npm run test        # testes do backend, inclui a regra crítica de segurança financeira
npm run build        # build de produção dos dois workspaces
```

## Regra de negócio crítica

Usuário operacional (ex.: Mecânico) **nunca** recebe campo financeiro (preço, desconto, total, custo, faturamento) em nenhuma resposta de API — o backend monta DTOs diferentes por perfil (`OperationalOSDTO`/`AdminOSDTO`, `OperationalProdutoDTO`/`AdminProdutoDTO`, etc.), nunca confiando em role enviada pelo frontend. Ver `backend/src/dto/` e o teste `backend/src/dto/__tests__/os.dto.test.ts`.

## Módulo de OS (Fase 4)

Ciclo completo: criar (cliente → equipamento → problema → prioridade), visualizar, editar diagnóstico/observações/solução, adicionar e remover produtos/serviços, mudar status e acompanhar o histórico. Cada ação tem sua própria permissão granular (`OS_CREATE`, `OS_EDIT`, `OS_CHANGE_STATUS`, `PRODUCT_ADD_TO_OS`, `SERVICE_ADD_TO_OS`), então um Mecânico pode mudar status e lançar peça/serviço mas não edita campos administrativos — reflexo direto do RBAC, não uma regra separada na UI.

Transições de status são validadas **só no backend** (`backend/src/services/osWorkflow.ts`); o frontend (`frontend/src/types/os.types.ts`) tem uma cópia do mapa de transições só para não oferecer opções óbvias-inválidas no seletor — nunca é ela quem decide.

## Estrutura

```
backend/src/
  config/        env, CORS, Firebird, Swagger
  controllers/   HTTP handlers
  services/      regra de negócio, monta DTOs por permissão, workflow de status da OS
  repositories/  interfaces + mocks CHERP (Fase 5 troca por Firebird real) + Postgres (auth)
  database/      firebird/ (pool, não usado ainda) · postgres/ (Drizzle: schema, migrations, seed)
  dto/           DTOs por perfil + mappers
  middlewares/   auth, RBAC, validação, rate limit, error handler
  auth/          JWT, hash de senha
  errors/        AppError e subclasses

frontend/src/
  api/               httpClient (refresh automático), auth/produtos/servicos/clientes/equipamentos/os.api
  store/             Zustand: auth, tema
  routes/            router, ProtectedRoute
  pages/             Login, Início, OS (lista/criar/detalhe), Produtos, Perfil
  components/ui/     biblioteca de componentes (Button/LinkButton, Input, Select, Badge/StatusBadge,
                      Card, Modal/Drawer, ConfirmDialog, Toast, Skeleton, EmptyState,
                      ErrorState, Pagination, SearchCombobox)
  components/layout/ AppShell (sidebar desktop + bottom nav mobile, mesma lista de itens)
  components/search/ ProdutoSearch, ServicoSearch, ClienteSearch, EquipamentoSearch (SearchCombobox + API real)
  components/os/      HistoryTimeline, StatusChanger (só filtra opções — backend sempre revalida)
  hooks/             useTheme, useDebouncedValue, useFocusTrap
  constants/         catálogo de status/prioridade de OS (rótulo + cor semântica)
  styles/            design tokens (claro/escuro, espaçamento, sombra, z-index)
```

## Roadmap (próximas fases)

Fase 5 (Firebird real, substituindo os mocks) · Fase 6 (catálogo completo de Produtos/Serviços com filtros avançados) · Fase 7 (Dashboard/relatórios) · Fase 8 (PWA offline completo) · Fase 9 (auditoria de negócio, hardening) · Fase 10 (testes abrangentes).
