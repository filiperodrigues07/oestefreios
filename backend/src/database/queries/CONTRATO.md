# Contrato de queries CHERP/Firebird

Este arquivo documenta exatamente o que cada repositório Firebird
(`backend/src/repositories/firebird/*.firebird.ts`) precisa que a query real
devolva. Quem tiver acesso ao schema do CHERP preenche o SQL nas constantes
`QUERY_*` de cada arquivo — nenhum outro lugar do código precisa mudar.

## Como ativar

1. Preencha as constantes `QUERY_*` no arquivo `*.firebird.ts` correspondente
   (estão `null` por padrão — cada método lança erro 501 claro enquanto isso).
2. Ajuste `mapRowToX()` no mesmo arquivo se os nomes de coluna reais forem
   diferentes dos exemplificativos usados aqui.
3. No `.env`, defina `CHERP_MODE=firebird` e preencha `FIREBIRD_HOST`,
   `FIREBIRD_PORT`, `FIREBIRD_DATABASE`, `FIREBIRD_USER`, `FIREBIRD_PASSWORD`.
4. Reinicie o backend. `repositories/index.ts` troca automaticamente para as
   implementações reais — controllers, services e DTOs não mudam.

## Regras gerais

- **Código nunca é number.** CHERP usa códigos com zeros à esquerda
  (ex. `"00012345"`). Toda query deve tratar o parâmetro de código como
  string/CHAR, nunca converter para inteiro.
- **Paginação**: os métodos `buscar()` recebem `page`/`limit` já calculados
  como `skip`/`limit` (offset/limite). Use `ROWS <skip+1> TO <skip+limit>` ou
  `FIRST <limit> SKIP <skip>`, conforme a versão do Firebird.
- **Filtro parcial por descrição**: os métodos já passam o termo com `%`
  (`%termo%`) pronto para `LIKE`/`CONTAINING` — não adicione `%` de novo na query.
- **Nunca** faça concatenação de string do usuário na query (SQL Injection) —
  sempre parâmetros posicionados (`?`), como os stubs já fazem.

## ProdutoRepository (`ProdutoRepository.firebird.ts`)

| Query | Parâmetros | Colunas esperadas |
|---|---|---|
| `QUERY_BUSCAR_POR_CODIGO` | `codigo` | `CODIGO, DESCRICAO, UNIDADE, DISPONIVEL, PRECO_UNITARIO, CUSTO` |
| `QUERY_BUSCAR_POR_DESCRICAO` | `%descricao%` | idem |
| `QUERY_BUSCAR_PAGINADO` | `codigo\|null, %descricao%\|null, skip, limit` | idem, várias linhas |
| `QUERY_CONTAR_TOTAL` | `codigo\|null, %descricao%\|null` | uma linha, coluna `TOTAL` |

`DISPONIVEL`, `PRECO_UNITARIO`, `CUSTO` podem vir `NULL` — o mapper já trata
como `undefined`. **Nunca omita `PRECO_UNITARIO`/`CUSTO` da query achando que
"protege" o mecânico** — quem decide o que o mecânico recebe é o DTO
(`dto/mappers/produto.mapper.ts`), não a query.

## ServicoRepository (`ServicoRepository.firebird.ts`)

| Query | Parâmetros | Colunas esperadas |
|---|---|---|
| `QUERY_BUSCAR_POR_CODIGO` | `codigo` | `CODIGO, DESCRICAO, UNIDADE, VALOR_UNITARIO` |
| `QUERY_BUSCAR_POR_DESCRICAO` | `%descricao%` | idem |
| `QUERY_BUSCAR_PAGINADO` | `codigo\|null, %descricao%\|null, skip, limit` | idem, várias linhas |
| `QUERY_CONTAR_TOTAL` | `codigo\|null, %descricao%\|null` | uma linha, coluna `TOTAL` |

## ClienteRepository (`ClienteRepository.firebird.ts`)

| Query | Parâmetros | Colunas esperadas |
|---|---|---|
| `QUERY_BUSCAR_POR_CODIGO` | `codigo` | `CODIGO, NOME, DOCUMENTO, TELEFONE` |
| `QUERY_BUSCAR_POR_NOME` | `%nome%` | idem |
| `QUERY_BUSCAR_PAGINADO` | `codigo\|null, %nome%\|null, skip, limit` | idem, várias linhas |
| `QUERY_CONTAR_TOTAL` | `codigo\|null, %nome%\|null` | uma linha, coluna `TOTAL` |

`DOCUMENTO` é CPF ou CNPJ, conforme o tipo de cliente — sem formatação
específica exigida pelo backend (a formatação, se houver, é decisão de UI).

## EquipamentoRepository (`EquipamentoRepository.firebird.ts`)

| Query | Parâmetros | Colunas esperadas |
|---|---|---|
| `QUERY_BUSCAR_POR_CODIGO` | `codigo` | `CODIGO, DESCRICAO, CLIENTE_CODIGO, IDENTIFICACAO` |
| `QUERY_BUSCAR_POR_CLIENTE` | `clienteCodigo` | idem, várias linhas |
| `QUERY_BUSCAR_PAGINADO` | `clienteCodigo\|null, codigo\|null, %descricao%\|null, skip, limit` | idem |
| `QUERY_CONTAR_TOTAL` | `clienteCodigo\|null, codigo\|null, %descricao%\|null` | uma linha, coluna `TOTAL` |

`CLIENTE_CODIGO` é a chave que liga o equipamento ao cliente — o fluxo de
criação de OS sempre busca equipamento já filtrado por este campo (seção 8
do briefing: equipamento só aparece depois do cliente selecionado).

## O que NÃO está neste contrato

- **Ordem de Serviço (OS)**: tem variante Firebird própria, mas fora do
  padrão `QUERY_*`/`CONTRATO.md` deste arquivo — grava/lê direto em
  `ORDEMSERVICO` + `ITENSORDEMSERVICOPROD`/`ITENSORDEMSERVICOSERV`. Ver
  `OSRepository.firebird.ts` e a seção "OS gravada direto no CHERP" no
  README (mapeamento de status, usuário de integração, pegadinhas de
  DEFAULT de coluna).
- **Autenticação/RBAC**: já roda 100% no Postgres da aplicação
  (`database/postgres/schema.ts`), não depende do CHERP.
