# Oeste Freios — Controle de OS

Sistema PWA de controle de Ordens de Serviço, integrado ao ERP Firebird (CHERP). Monorepo com backend (Express/TypeScript, arquitetura em camadas) e frontend (Vite/React/TypeScript, PWA).

Status: **Fases 1-9** concluídas e testadas (**Fase 5 — Firebird real — com SQL real escrito e validado contra o banco CHERP do cliente, incluindo OS gravando de verdade em `ORDEMSERVICO`**, não só catálogo/consulta). Fase 10 (testes abrangentes) em stand by. Ver "Roadmap" no fim deste README.

## Stack

- **Backend**: Node.js, TypeScript, Express, Zod, JWT + refresh token rotativo, Argon2id, Pino, Helmet, Drizzle ORM (Postgres), Swagger/OpenAPI.
- **Frontend**: React, TypeScript, Vite, React Router, Zustand, TanStack Query, PWA (vite-plugin-pwa), design tokens CSS com tema claro/escuro.
- **Banco da aplicação**: PostgreSQL (usuários, perfis, permissões, refresh tokens, auditoria).
- **CHERP/Firebird**: schema real é o Questor (`node-firebird`). SQL real escrito e validado contra o banco do cliente — ver "CHERP real (Fase 5)" abaixo. `CHERP_MODE=firebird` já é o padrão no `.env` local; `mock` continua disponível para rodar sem o banco.

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

Schema real descoberto explorando o banco do cliente (RDB$RELATIONS/RDB$RELATION_FIELDS) — é o ERP **Questor**. Produtos e serviços moram na mesma tabela `PRODUTO` (`TIPO = 9` é serviço, `PRODUTOTIPO.CODIGO = 9` "SERVIÇOS"); preço vem de `PRODUTOVENDA`, custo de `PRODUTOCUSTO`, estoque de `PRODUTOESTOQUE`; clientes ficam em `CLIFOR` (`CLIENTE = 'S'`); equipamentos em `EQUIPAMENTOS`, ligados a `CLIFOR` por `CHAVECLIFOR`. As queries reais estão em `backend/src/repositories/firebird/*.firebird.ts`; o contrato coluna-a-coluna documentado em `backend/src/database/queries/CONTRATO.md` continua valendo como referência.

**Pegadinha real que apareceu testando** (a mais cara desta fase): o banco do cliente declara as colunas de texto com charset `NONE`, mas os bytes são Windows-1252 — o driver `node-firebird` decodifica colunas `NONE` como UTF-8 e corrompe qualquer acentuação (`SERVIÇO` virava `SERVI�O`, irreversível). Resolvido em duas pontas, centralizadas em `backend/src/database/firebird/encoding.ts`:
- **Leitura**: todo campo de texto livre (descrição, nome) é lido via `CAST(coluna AS VARCHAR(n) CHARACTER SET OCTETS)`, que faz o driver devolver `Buffer` cru em vez de tentar decodificar como texto; `firebirdQuery()` (`database/firebird/pool.ts`) decodifica esse `Buffer` como latin1 automaticamente em todo resultado, então nenhum `mapRowToX()` precisou mudar.
- **Busca (`LIKE`)**: o termo digitado precisa ir como `Buffer` latin1 (`toLatin1SearchParam`), nunca como `string` JS — senão o driver manda os bytes em UTF-8 e não bate com os bytes latin1 armazenados. Busca é case-insensitive via `UPPER()` no SQL, mas o fallback `COALESCE(?, '%')` para "sem filtro" precisou ser `CAST('%' AS VARCHAR(100) CHARACTER SET OCTETS)` explícito — sem o `CHARACTER SET OCTETS`, o Firebird infere o tipo do parâmetro a partir do literal `'%'` (`CHAR(1)`) e trunca/rejeita qualquer termo acentuado com `-303 Malformed string`.

Para trocar entre mock e Firebird real:

1. No `.env`, defina `CHERP_MODE=firebird` (ou `mock`) e as credenciais `FIREBIRD_*`.
2. Reinicie o backend — nenhum controller, service ou DTO muda (`repositories/index.ts` resolve pela env).

## OS gravada direto no CHERP (Fase 5+)

Requisito do cliente: toda OS lançada pelo app tem que existir de verdade no CHERP (fazer INSERT em `ORDEMSERVICO`), e uma OS lançada direto no CHERP tem que aparecer na nossa aplicação. `backend/src/repositories/firebird/OSRepository.firebird.ts` faz as duas pontas:

- **Cabeçalho, itens e totais** (cliente, equipamento, problema, produtos/serviços lançados, `TOTALPRODUTO`/`TOTALSERVICO`/`TOTALOS`) gravam de verdade em `ORDEMSERVICO` + `ITENSORDEMSERVICOPROD`/`ITENSORDEMSERVICOSERV`, igual a uma OS aberta na tela do CHERP. Remover um item marca `ATIVO = 0` (soft delete), o mesmo padrão que as triggers do próprio CHERP já esperam — nunca `DELETE`.
- **O que o CHERP não tem campo pra guardar** (nosso workflow de 7 status contra o binário aberto/fechado dele, prioridade, histórico de eventos, responsável/técnico — usuários do app, sem cadastro no CHERP) fica em `os_workflow` (Postgres), ligado por `id` = `ORDEMSERVICO.IDENTIFICADOR` (UUID que o próprio CHERP gera). Uma OS que nasceu direto no CHERP não tem linha aí ainda — a leitura usa um fallback (aberta/concluída inferido de `SITUACAO`, prioridade "NORMAL", histórico sintético "OS aberta no CHERP") até a primeira edição feita pelo app, que materializa a linha.
- `CHAVEUSUARIOINICIOU`/`CHAVEUSUARIOFECHOU` sempre gravam um usuário fixo de integração do CHERP (`FIREBIRD_OS_USUARIO_CHAVE` no `.env`, decisão do cliente — não é mapeado por usuário do app).
- `SITUACAO`: `0` = aberta, `5` = fechada (confirmado pela mensagem da exception `SITUACAO_DAVOS` do próprio CHERP: `"DAV-OS 'FECHADO' NÃO PODE SER 'ABERTO'"`). Nossos status intermediários (`EM_ANALISE`, `AGUARDANDO_PECA` etc.) só existem no lado do app — pro CHERP, qualquer coisa que não seja `CONCLUIDA`/`CANCELADA` é "aberta".
- **Pegadinha cara desta parte**: os domínios `DATAFECHA` e `DATAENTREGA` em `ORDEMSERVICO` têm `DEFAULT 'NOW'` — se você não inclui a coluna no INSERT (achando que "fica NULL por padrão"), o CHERP silenciosamente preenche com a data de hoje, e uma OS recém-aberta aparece como se já tivesse sido fechada/entregue. As duas colunas têm que ir com `NULL` explícito no INSERT.
- Números da OS (`ORDEM`, ex. `"000007"`) vêm de `GEN_ID(GEN_ORDEMSERVICO_ID, 1)`, o mesmo gerador que o CHERP usa — nunca inventado no app.
- `listar()` faz o filtro de `clienteCodigo` no Firebird, mas `status`/`tecnicoId` (que só existem em `os_workflow`) são aplicados em memória sobre uma janela das últimas ~500 OS — funciona bem pro volume de uma oficina, mas não escala pra um histórico muito grande sem repensar a paginação cross-banco.

**Buscador de equipamento por placa/código do veículo**: pendente — aguardando print da tela do CH pra confirmar os campos exatos antes de mexer em `EquipamentoRepository.firebird.ts`/`EquipamentoSearch.tsx`.

## Catálogo de Produtos e Serviços (Fase 6)

Tela única em `/produtos` com abas Produtos/Serviços, cada uma com busca (código prioriza sobre descrição, seção 36), ordenação por código ou descrição, paginação e um modal de detalhe. Reaproveita o componente genérico `frontend/src/components/catalog/CatalogList.tsx` — a única coisa que muda entre as abas é a função de busca e qual campo de preço mostrar. Preço/valor só aparecem, na lista e no detalhe, quando o backend os envia (perfil com `FINANCIAL_VIEW`); testei lado a lado admin vs. Mecânico e confirmei zero "R$" na tela do Mecânico.

## Dashboard (Fase 7)

Tela Início vira dashboard administrativo ou operacional conforme a permissão `REPORT_VIEW`:

- **Administrativo**: cards de OS por status, tempo médio de conclusão, indicadores financeiros (só com `FINANCIAL_VIEW` — testado: some inteiro pro Mecânico, nem a seção aparece), gráficos de barra "OS por status"/"OS por prioridade" (cor = mesma identidade dos badges já usados no resto do app) e rankings de "Produtos/Serviços mais utilizados" + "OS por técnico" (cor única por regra do skill de dataviz — nominal ranking não ganha cor por barra, isso seria um encoding falso).
- **Operacional** (seção 19 do briefing): só "Minhas OS" — 4 cards de contagem (Pendentes/Em andamento/Aguardando/Concluídas) e a lista das OS onde o usuário é técnico ou responsável, sem nenhum campo financeiro.

Paleta categórica dos gráficos validada contra as superfícies reais do app (`node scripts/validate_palette.js` do skill de dataviz, luz e escuro) antes de virar token em `frontend/src/styles/tokens.css` (`--chart-series-*`) — não foi escolhida no olho.

## PWA offline (Fase 8)

- **Ícones e manifest reais**: PNG 192/512 + maskable + apple-touch-icon (gerados a partir do SVG), não só o `icon.svg` que a Fase 1 deixou.
- **Estratégia de cache**: assets do build ficam disponíveis offline via precache do Workbox. Respostas de `GET /api/*` não são armazenadas no aparelho, para evitar exposição de dados de clientes após troca de usuário ou logout. Sem conexão, os dados da API não ficam disponíveis.
- **Indicador de conexão**: banner fixo "Você está offline" (`useOnlineStatus` + `OfflineBanner`) sempre que a conexão cai, e a tela de login explica por que não dá pra entrar offline (o token só vive em memória — decisão de segurança da Fase 2 — então um reload a frio sem internet não tem sessão pra restaurar; isso é intencional, não um bug).
- **Atualização automática**: `registerType:'autoUpdate'` já troca a versão sozinho; um toast avisa quando o app fica pronto para uso offline.
- **Fila de sincronização** (seção 26): mutação que falha por falta de conexão de verdade vai pro IndexedDB (`frontend/src/pwa/offlineQueue.ts`) em vez de tentar e fingir sucesso — a UI mostra "a alteração foi guardada e será sincronizada quando a internet voltar" (nunca um toast de sucesso genérico). Ao reconectar, a fila sincroniza sozinha e avisa quantas alterações foram sincronizadas ou falharam.

**Pegadinha real que apareceu testando**: o TanStack Query tem um `networkMode` padrão que *pausa* mutações inteiras quando `navigator.onLine` é falso, sem nunca chamar a função da mutação — isso deixava a fila offline morta silenciosamente, porque o `apiFetch` nunca era invocado pra detectar a falha. Corrigido com `mutations: { networkMode: 'always' }` em `frontend/src/api/queryClient.ts`, pra ser o próprio `httpClient.ts` quem decide o que fazer com a falha de rede.

O fluxo offline inclui manifest com ícones PNG, service worker para assets, banner de conexão e fila de mutações. Ao reconectar, a fila sincroniza as operações do usuário correspondente; respostas da API não são preservadas para leitura offline.

## Auditoria e testes de autorização (Fase 9)

- **Trilha de auditoria de negócio** (seção 24): toda mutação de OS (criar, atualizar, mudar status, adicionar/remover produto/serviço) grava um evento durável em `audit_logs` no Postgres — usuário, entidade afetada, diff `{before, after}`, IP, data/hora. Separada do `historico` embutido na OS (que é a linha do tempo mostrada pro usuário, seção 15); esta é a trilha protegida, só para quem tem `SYSTEM_SETTINGS`. Mesma regra financeira do resto do app: campos como `precoUnitario`/`total` são removidos do diff se o perfil não tiver `FINANCIAL_VIEW` (`backend/src/services/auditLog.service.ts`).
- **Tela `/auditoria`**: lista paginada com filtro por evento/entidade, modal de detalhe com o diff completo. Só aparece no Perfil (nunca na navegação principal) para quem tem `SYSTEM_SETTINGS` — testado que o Mecânico não vê o link **e** que a API responde 403 se ele tentar acessar a URL direto (nunca confiar só em esconder na UI).
- **Suite de testes de autorização** (`backend/src/__tests__/authorization.test.ts`, via `supertest` contra a instância real do Express): 401 sem token, 403 com token válido mas sem a permissão certa, 200 com a permissão certa, em `/os`, `/dashboard/admin`, `/audit-logs` e `/produtos` — incluindo a regra crítica (produto sem `precoUnitario` pro token sem `FINANCIAL_VIEW`). Mais um teste de ponta a ponta (`auditLog.test.ts`) provando que criar uma OS de verdade grava e aparece na consulta de auditoria.

## Estrutura

```
backend/src/
  config/        env, CORS, Firebird, Swagger
  controllers/   HTTP handlers
  services/      regra de negócio, monta DTOs por permissão, workflow de status da OS, auditLog.service
  repositories/  interfaces + mock/ + firebird/ (SQL real, schema Questor, OS inclusive — CHERP_MODE) + postgres/ (auth)
  database/      firebird/ (pool + transação + encoding NONE→latin1) · postgres/ (Drizzle: schema incl. os_workflow, migrations, seed) · queries/CONTRATO.md
  dto/           DTOs por perfil + mappers
  middlewares/   auth, RBAC, validação, rate limit, error handler
  auth/          JWT, hash de senha
  errors/        AppError e subclasses

frontend/src/
  api/               httpClient (refresh automático), auth/produtos/servicos/clientes/equipamentos/os.api
  store/             Zustand: auth, tema
  routes/            router, ProtectedRoute
  pages/             Login, Início, OS (lista/criar/detalhe), Produtos (catálogo com abas), Perfil, Auditoria
  components/ui/     biblioteca de componentes (Button/LinkButton, Input, Select, Badge/StatusBadge,
                      Card, Modal/Drawer, ConfirmDialog, Toast, Skeleton, EmptyState,
                      ErrorState, Pagination, SearchCombobox)
  components/layout/ AppShell (sidebar desktop + bottom nav mobile, mesma lista de itens)
  components/search/ ProdutoSearch, ServicoSearch, ClienteSearch, EquipamentoSearch (SearchCombobox + API real)
  components/os/      HistoryTimeline, StatusChanger (só filtra opções — backend sempre revalida)
  components/catalog/ CatalogList (busca + ordenação + paginação, genérico, usado por Produtos e Serviços)
  components/charts/  StatTile, BarList, formatters (número/dinheiro compactos) — paleta validada, ver Fase 7
  components/dashboard/ AdminDashboard, OperationalDashboard
  hooks/             useTheme, useDebouncedValue, useFocusTrap, useOnlineStatus, useOfflineSync, usePwaUpdate
  pwa/               offlineQueue (IndexedDB), OfflineQueuedError, offlineErrorToast
  constants/         catálogo de status/prioridade de OS (rótulo + cor semântica)
  styles/            design tokens (claro/escuro, espaçamento, sombra, z-index, paleta de gráficos)
```

## Roadmap (próximas fases)

Fase 10 (testes abrangentes — E2E, cobertura mais ampla além da autorização já feita na Fase 9) — em stand by. Visual/design: pendente, próximo passo combinado com o cliente depois de validar o funcional.
