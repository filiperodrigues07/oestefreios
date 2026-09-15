# Oeste Freios — Controle de OS

Sistema PWA de controle de Ordens de Serviço, integrado ao ERP Firebird (CHERP). Monorepo com backend (Express/TypeScript, arquitetura em camadas) e frontend (Vite/React/TypeScript, PWA).

Status: **Fases 1-4, 6 (catálogo) e 7 (dashboard)** concluídas e testadas. Estrutura da **Fase 5 (Firebird real)** pronta, aguardando as queries reais do CHERP. Ver "Roadmap" no fim deste README.

## Stack

- **Backend**: Node.js, TypeScript, Express, Zod, JWT + refresh token rotativo, Argon2id, Pino, Helmet, Drizzle ORM (Postgres), Swagger/OpenAPI.
- **Frontend**: React, TypeScript, Vite, React Router, Zustand, TanStack Query, PWA (vite-plugin-pwa), design tokens CSS com tema claro/escuro.
- **Banco da aplicação**: PostgreSQL (usuários, perfis, permissões, refresh tokens, auditoria).
- **CHERP/Firebird**: repositórios com interface pronta. Por padrão (`CHERP_MODE=mock`) rodam em memória; a implementação real em `backend/src/repositories/firebird/` já existe e só falta o SQL — ver "CHERP real (Fase 5)" abaixo.

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

## CHERP real (Fase 5)

A troca do mock pelo Firebird real está pronta, só falta o SQL:

1. Preencha as constantes `QUERY_*` em `backend/src/repositories/firebird/*.firebird.ts` com as queries reais (contrato completo, coluna a coluna, em `backend/src/database/queries/CONTRATO.md`).
2. No `.env`, defina `CHERP_MODE=firebird` e as credenciais `FIREBIRD_*`.
3. Reinicie o backend — nenhum controller, service ou DTO muda.

Enquanto uma query não for preenchida, o endpoint correspondente responde `501 CHERP_QUERY_NOT_IMPLEMENTED` (nunca dado inventado ou silêncio) — comportamento garantido por teste (`backend/src/repositories/firebird/__tests__/firebirdGuard.test.ts`). OS não tem variante Firebird: sua persistência é decisão própria da aplicação, ainda em aberto.

## Catálogo de Produtos e Serviços (Fase 6)

Tela única em `/produtos` com abas Produtos/Serviços, cada uma com busca (código prioriza sobre descrição, seção 36), ordenação por código ou descrição, paginação e um modal de detalhe. Reaproveita o componente genérico `frontend/src/components/catalog/CatalogList.tsx` — a única coisa que muda entre as abas é a função de busca e qual campo de preço mostrar. Preço/valor só aparecem, na lista e no detalhe, quando o backend os envia (perfil com `FINANCIAL_VIEW`); testei lado a lado admin vs. Mecânico e confirmei zero "R$" na tela do Mecânico.

## Dashboard (Fase 7)

Tela Início vira dashboard administrativo ou operacional conforme a permissão `REPORT_VIEW`:

- **Administrativo**: cards de OS por status, tempo médio de conclusão, indicadores financeiros (só com `FINANCIAL_VIEW` — testado: some inteiro pro Mecânico, nem a seção aparece), gráficos de barra "OS por status"/"OS por prioridade" (cor = mesma identidade dos badges já usados no resto do app) e rankings de "Produtos/Serviços mais utilizados" + "OS por técnico" (cor única por regra do skill de dataviz — nominal ranking não ganha cor por barra, isso seria um encoding falso).
- **Operacional** (seção 19 do briefing): só "Minhas OS" — 4 cards de contagem (Pendentes/Em andamento/Aguardando/Concluídas) e a lista das OS onde o usuário é técnico ou responsável, sem nenhum campo financeiro.

Paleta categórica dos gráficos validada contra as superfícies reais do app (`node scripts/validate_palette.js` do skill de dataviz, luz e escuro) antes de virar token em `frontend/src/styles/tokens.css` (`--chart-series-*`) — não foi escolhida no olho.

## Estrutura

```
backend/src/
  config/        env, CORS, Firebird, Swagger
  controllers/   HTTP handlers
  services/      regra de negócio, monta DTOs por permissão, workflow de status da OS
  repositories/  interfaces + mock/ (padrão) + firebird/ (real, falta só o SQL — CHERP_MODE) + postgres/ (auth)
  database/      firebird/ (pool) · postgres/ (Drizzle: schema, migrations, seed) · queries/CONTRATO.md
  dto/           DTOs por perfil + mappers
  middlewares/   auth, RBAC, validação, rate limit, error handler
  auth/          JWT, hash de senha
  errors/        AppError e subclasses

frontend/src/
  api/               httpClient (refresh automático), auth/produtos/servicos/clientes/equipamentos/os.api
  store/             Zustand: auth, tema
  routes/            router, ProtectedRoute
  pages/             Login, Início, OS (lista/criar/detalhe), Produtos (catálogo com abas), Perfil
  components/ui/     biblioteca de componentes (Button/LinkButton, Input, Select, Badge/StatusBadge,
                      Card, Modal/Drawer, ConfirmDialog, Toast, Skeleton, EmptyState,
                      ErrorState, Pagination, SearchCombobox)
  components/layout/ AppShell (sidebar desktop + bottom nav mobile, mesma lista de itens)
  components/search/ ProdutoSearch, ServicoSearch, ClienteSearch, EquipamentoSearch (SearchCombobox + API real)
  components/os/      HistoryTimeline, StatusChanger (só filtra opções — backend sempre revalida)
  components/catalog/ CatalogList (busca + ordenação + paginação, genérico, usado por Produtos e Serviços)
  components/charts/  StatTile, BarList, formatters (número/dinheiro compactos) — paleta validada, ver Fase 7
  components/dashboard/ AdminDashboard, OperationalDashboard
  hooks/             useTheme, useDebouncedValue, useFocusTrap
  constants/         catálogo de status/prioridade de OS (rótulo + cor semântica)
  styles/            design tokens (claro/escuro, espaçamento, sombra, z-index)
```

## Roadmap (próximas fases)

Fase 5 (SQL real do CHERP — estrutura pronta, ver acima) · Fase 8 (PWA offline completo) · Fase 9 (auditoria de negócio, hardening) · Fase 10 (testes abrangentes).
