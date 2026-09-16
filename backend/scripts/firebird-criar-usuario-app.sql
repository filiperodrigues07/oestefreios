-- =============================================================================
-- Oeste Freios — usuário de conexão do Firebird/CHERP para o backend do app
-- =============================================================================
-- Hoje o backend conecta no Firebird com FIREBIRD_USER=SYSDBA (superusuário,
-- acesso total ao banco inteiro) — ver backend/src/config/env.ts. Este script cria
-- um usuário dedicado, só com GRANT nas tabelas e generators que o app realmente
-- usa (levantado direto do código em backend/src/repositories/firebird/*.ts),
-- em vez de continuar usando SYSDBA em produção.
--
-- Como rodar:
--   1. Troque 'SenhaForteAqui123!' por uma senha de verdade antes de executar.
--   2. Rode como SYSDBA (ou outro usuário com privilégio de GRANT) contra o
--      banco do CHERP, via isql ou o cliente de administração do Firebird:
--        isql -user SYSDBA -password <senha_do_sysdba> <caminho_ou_alias_do_banco> -i firebird-criar-usuario-app.sql
--   3. Atualize FIREBIRD_USER/FIREBIRD_PASSWORD no .env do backend (ou na tela
--      Configurações > Firebird do próprio app, que já testa a conexão antes
--      de salvar — Fase C da rodada de melhorias).
--
-- Este script cobre só leitura/escrita de dados (DML). Não inclui DDL (criar
-- tabela, trigger, generator) — o app nunca faz isso, só usa o que já existe
-- no schema Questor do CHERP.
-- =============================================================================

CREATE USER OESTE_FREIOS_APP PASSWORD 'SenhaForteAqui123!';

-- -----------------------------------------------------------------------------
-- Tabelas só de leitura (o app nunca grava nelas)
-- -----------------------------------------------------------------------------
-- UNIDADE, GRUPOPRODUTO, PRODUTOVENDA, PRODUTOCUSTO, PRODUTOESTOQUE: consultadas
--   ao listar/buscar produtos e serviços (catálogo, preço, custo, saldo em estoque).
-- PRODUTO: catálogo de produtos/serviços — cadastro fica só no CHERP.
-- CIDADE: usada pra resolver/gravar a cidade do cliente por nome (Clientes, Fase E).
GRANT SELECT ON TABLE UNIDADE TO USER OESTE_FREIOS_APP;
GRANT SELECT ON TABLE GRUPOPRODUTO TO USER OESTE_FREIOS_APP;
GRANT SELECT ON TABLE PRODUTO TO USER OESTE_FREIOS_APP;
GRANT SELECT ON TABLE PRODUTOVENDA TO USER OESTE_FREIOS_APP;
GRANT SELECT ON TABLE PRODUTOCUSTO TO USER OESTE_FREIOS_APP;
GRANT SELECT ON TABLE PRODUTOESTOQUE TO USER OESTE_FREIOS_APP;
GRANT SELECT ON TABLE CIDADE TO USER OESTE_FREIOS_APP;

-- -----------------------------------------------------------------------------
-- Tabelas de leitura e escrita (o app cadastra/edita, sempre com soft-delete —
-- nunca faz DELETE de verdade, só UPDATE ATIVO = 0, então DELETE não é concedido)
-- -----------------------------------------------------------------------------
-- CLIFOR: clientes (consulta + cadastro, Fase E).
GRANT SELECT, INSERT, UPDATE ON TABLE CLIFOR TO USER OESTE_FREIOS_APP;

-- EQUIPAMENTOS: veículos vinculados ao cliente (Fase E).
GRANT SELECT, INSERT, UPDATE ON TABLE EQUIPAMENTOS TO USER OESTE_FREIOS_APP;

-- ORDEMSERVICO: cabeçalho da OS (criar, editar, mudar situação).
GRANT SELECT, INSERT, UPDATE ON TABLE ORDEMSERVICO TO USER OESTE_FREIOS_APP;

-- ITENSORDEMSERVICOPROD / ITENSORDEMSERVICOSERV: produtos/serviços lançados na OS
--   (grid de lançamento, Fase H) — remover um item é UPDATE ATIVO = 0, não DELETE.
GRANT SELECT, INSERT, UPDATE ON TABLE ITENSORDEMSERVICOPROD TO USER OESTE_FREIOS_APP;
GRANT SELECT, INSERT, UPDATE ON TABLE ITENSORDEMSERVICOSERV TO USER OESTE_FREIOS_APP;

-- -----------------------------------------------------------------------------
-- Generators (GEN_ID) — usados pra calcular a próxima CHAVE ao criar cliente,
-- veículo ou OS (ver GEN_ID(GEN_..._ID, 1) nos repositórios Firebird). Usando a
-- palavra-chave GENERATOR (em vez de SEQUENCE) pra funcionar também em Firebird
-- 2.5, comum em instalações mais antigas de ERP — SEQUENCE só existe desde o FB3.
-- -----------------------------------------------------------------------------
GRANT USAGE ON GENERATOR GEN_CLIFOR_ID TO USER OESTE_FREIOS_APP;
GRANT USAGE ON GENERATOR GEN_EQUIPAMENTOS_ID TO USER OESTE_FREIOS_APP;
GRANT USAGE ON GENERATOR GEN_ORDEMSERVICO_ID TO USER OESTE_FREIOS_APP;

-- -----------------------------------------------------------------------------
-- RDB$DATABASE: pseudo-tabela do sistema, usada só como "FROM" nas chamadas de
-- GEN_ID (ex.: SELECT GEN_ID(GEN_CLIFOR_ID, 1) FROM RDB$DATABASE). Na maioria
-- das instalações Firebird qualquer usuário já pode fazer SELECT nela; este
-- GRANT garante isso mesmo que o CHERP tenha restringido o padrão.
-- -----------------------------------------------------------------------------
GRANT SELECT ON TABLE RDB$DATABASE TO USER OESTE_FREIOS_APP;

COMMIT;
