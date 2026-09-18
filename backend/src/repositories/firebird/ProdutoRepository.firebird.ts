import { firebirdQuery } from '../../database/firebird/pool.js';
import { toLatin1SearchParam } from '../../database/firebird/encoding.js';
import { NotImplementedError } from '../../errors/NotImplementedError.js';
import type { PaginatedResult, Produto, SearchQuery } from '../../types/cherp.types.js';
import type { IProdutoRepository } from '../interfaces/IProdutoRepository.js';

/**
 * Implementação real contra o Firebird/CHERP (schema Questor). Produtos e serviços
 * moram na mesma tabela PRODUTO — TIPO = 9 é serviço (ver PRODUTOTIPO.CODIGO = 9
 * "SERVIÇOS"), qualquer outro TIPO é produto/mercadoria. Preço vem de PRODUTOVENDA
 * e custo de PRODUTOCUSTO (uma linha por tabela de preço; pegamos a primeira ativa
 * por produto via subquery FIRST 1). Estoque soma PRODUTOESTOQUE por não haver
 * filtro de depósito no contrato desta fase; estoque mínimo pega a primeira linha
 * ativa (raramente há mais de um depósito configurado nesse porte de oficina).
 * Categoria vem de GRUPOPRODUTO via CHAVEGRUPO.
 *
 * As colunas de texto (DESCRICAO) têm charset NONE no banco real mas contêm bytes
 * Windows-1252 — por isso o CAST ... CHARACTER SET OCTETS (decodificado como latin1
 * em `database/firebird/encoding.ts`). Termos de busca com acento entram como
 * Buffer latin1 (`toLatin1Param`), não como string, pelo mesmo motivo.
 */

const PRODUTO_SELECT = `
  P.CODIGO AS CODIGO,
  CAST(P.DESCRICAO AS VARCHAR(100) CHARACTER SET OCTETS) AS DESCRICAO,
  U.UNMAIOR AS UNIDADE,
  CAST(G.DESCRICAO AS VARCHAR(100) CHARACTER SET OCTETS) AS CATEGORIA,
  CAST(PT.DESCRICAO AS VARCHAR(100) CHARACTER SET OCTETS) AS TIPO_DESCRICAO,
  (SELECT SUM(PE.SALDO) FROM PRODUTOESTOQUE PE WHERE PE.CHAVEPRODUTO = P.CHAVE AND PE.ATIVO = 1) AS DISPONIVEL,
  (SELECT FIRST 1 PE2.ESTOQUEMINIMO FROM PRODUTOESTOQUE PE2 WHERE PE2.CHAVEPRODUTO = P.CHAVE AND PE2.ATIVO = 1 ORDER BY PE2.CHAVE) AS ESTOQUE_MINIMO,
  PV.PRECOVENDA AS PRECO_UNITARIO,
  PC.PRECOCUSTO AS CUSTO
FROM PRODUTO P
LEFT JOIN UNIDADE U ON U.CHAVE = P.CHAVEUNIDADE
LEFT JOIN GRUPOPRODUTO G ON G.CHAVE = P.CHAVEGRUPO
LEFT JOIN PRODUTOTIPO PT ON PT.CODIGO = P.TIPO AND PT.ATIVO = 1
LEFT JOIN PRODUTOVENDA PV ON PV.CHAVE = (
  SELECT FIRST 1 PV2.CHAVE FROM PRODUTOVENDA PV2
  WHERE PV2.CHAVEPRODUTO = P.CHAVE AND PV2.ATIVO = 1
  ORDER BY PV2.CHAVETABELAPRECO
)
LEFT JOIN PRODUTOCUSTO PC ON PC.CHAVE = (
  SELECT FIRST 1 PC2.CHAVE FROM PRODUTOCUSTO PC2
  WHERE PC2.CHAVEPRODUTO = P.CHAVE AND PC2.ATIVO = 1
  ORDER BY PC2.CHAVE
)`;

// TRIM LEADING '0' em ambos os lados: código real é zero-padded (ex. "001258") mas o usuário
// digita sem os zeros na busca exata (ex. "1258") — comparar ignorando os zeros à esquerda.
const QUERY_BUSCAR_POR_CODIGO: string | null = `
  SELECT ${PRODUTO_SELECT}
  WHERE P.ATIVO = 1 AND P.TIPO <> 9 AND TRIM(LEADING '0' FROM P.CODIGO) = TRIM(LEADING '0' FROM ?)
`;

const QUERY_BUSCAR_POR_DESCRICAO: string | null = `
  SELECT ${PRODUTO_SELECT}
  WHERE P.ATIVO = 1 AND P.TIPO <> 9 AND UPPER(P.DESCRICAO) LIKE ?
`;

// Busca livre — mesmo padrão unificado usado em OS/Clientes: um termo só casa contra código,
// descrição ou categoria de uma vez (OR), sem precisar adivinhar se é dígito ou texto.
// CODIGO por LIKE (não igualdade): usuário digita sem os zeros à esquerda do código real do CHERP
// (ex. "1258" pro código real "001258") — igualdade exata nunca batia, buscar sempre voltava vazio.
const BUSCA_CONDICAO = `
  (
    ? IS NULL OR (
      UPPER(CAST(P.CODIGO AS VARCHAR(50))) LIKE ?
      OR UPPER(P.DESCRICAO) LIKE ?
      OR UPPER(G.DESCRICAO) LIKE ?
      OR UPPER(PT.DESCRICAO) LIKE ?
    )
  )
`;

// Parâmetros: limit, skip, busca|null x4 (ver buscar() abaixo). Sem ORDER BY fixo — buscar()
// completa com a coluna/direção validadas pelo zod (sortBy/sortOrder).
const QUERY_BUSCAR_PAGINADO_BASE: string | null = `
  SELECT FIRST ? SKIP ? ${PRODUTO_SELECT}
  WHERE P.ATIVO = 1 AND P.TIPO <> 9
    AND ${BUSCA_CONDICAO}
`;

const QUERY_CONTAR_TOTAL: string | null = `
  SELECT COUNT(*) AS TOTAL
  FROM PRODUTO P
  LEFT JOIN GRUPOPRODUTO G ON G.CHAVE = P.CHAVEGRUPO
  LEFT JOIN PRODUTOTIPO PT ON PT.CODIGO = P.TIPO AND PT.ATIVO = 1
  WHERE P.ATIVO = 1 AND P.TIPO <> 9
    AND ${BUSCA_CONDICAO}
`;

/** sortBy/sortOrder já vêm validados por enum no zod (search.validator.ts) — seguro interpolar direto. */
function buildOrderBy(query: SearchQuery): string {
  const coluna =
    query.sortBy === 'codigo' ? 'P.CODIGO' :
    query.sortBy === 'categoria' ? 'G.DESCRICAO' :
    query.sortBy === 'tipo' ? 'PT.DESCRICAO' :
    'P.DESCRICAO';
  const direcao = query.sortOrder === 'desc' ? 'DESC' : 'ASC';
  return `${coluna} ${direcao}`;
}

function mapRowToProduto(row: Record<string, unknown>): Produto {
  return {
    // CHERP usa códigos com zeros à esquerda — nunca converter para number (ver seção 36 do briefing).
    codigo: String(row.CODIGO ?? row.codigo),
    descricao: String(row.DESCRICAO ?? row.descricao),
    unidade: String(row.UNIDADE ?? row.unidade),
    categoria: row.CATEGORIA ? String(row.CATEGORIA) : undefined,
    tipo: row.TIPO_DESCRICAO ? String(row.TIPO_DESCRICAO) : undefined,
    disponivel: row.DISPONIVEL !== undefined && row.DISPONIVEL !== null ? Number(row.DISPONIVEL) : undefined,
    estoqueMinimo:
      row.ESTOQUE_MINIMO !== undefined && row.ESTOQUE_MINIMO !== null ? Number(row.ESTOQUE_MINIMO) : undefined,
    precoUnitario: row.PRECO_UNITARIO !== undefined ? Number(row.PRECO_UNITARIO) : undefined,
    custo: row.CUSTO !== undefined ? Number(row.CUSTO) : undefined,
  };
}

export class ProdutoRepositoryFirebird implements IProdutoRepository {
  async buscarPorCodigo(codigo: string): Promise<Produto | null> {
    if (!QUERY_BUSCAR_POR_CODIGO) throw new NotImplementedError('ProdutoRepository.buscarPorCodigo');
    const rows = await firebirdQuery(QUERY_BUSCAR_POR_CODIGO, [codigo.trim()]);
    return rows[0] ? mapRowToProduto(rows[0]) : null;
  }

  async buscarPorDescricao(descricao: string): Promise<Produto[]> {
    if (!QUERY_BUSCAR_POR_DESCRICAO) throw new NotImplementedError('ProdutoRepository.buscarPorDescricao');
    const rows = await firebirdQuery(QUERY_BUSCAR_POR_DESCRICAO, [toLatin1SearchParam(descricao)]);
    return rows.map(mapRowToProduto);
  }

  async buscar(query: SearchQuery): Promise<PaginatedResult<Produto>> {
    if (!QUERY_BUSCAR_PAGINADO_BASE || !QUERY_CONTAR_TOTAL) throw new NotImplementedError('ProdutoRepository.buscar');
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    // Aceita `busca` (novo, unificado) ou os antigos `codigo`/`descricao` isolados pra não quebrar
    // quem ainda manda um dos dois — o termo efetivo é o primeiro que vier preenchido.
    const termo = query.busca ?? query.codigo ?? query.descricao ?? null;
    const buscaFlag = termo ? termo.trim() : null;
    const buscaCodigoLike = buscaFlag ? Buffer.from(`%${buscaFlag.toUpperCase().replace(/[^A-Z0-9]/g, '')}%`, 'latin1') : null;
    const buscaTextoLike = buscaFlag ? toLatin1SearchParam(buscaFlag) : null;
    const buscaParams = [buscaFlag, buscaCodigoLike, buscaTextoLike, buscaTextoLike, buscaTextoLike];
    const queryPaginada = `${QUERY_BUSCAR_PAGINADO_BASE} ORDER BY ${buildOrderBy(query)}`;

    const [rows, countRows] = await Promise.all([
      firebirdQuery(queryPaginada, [limit, skip, ...buscaParams]),
      firebirdQuery<{ TOTAL: number }>(QUERY_CONTAR_TOTAL, buscaParams),
    ]);

    return {
      items: rows.map(mapRowToProduto),
      page,
      limit,
      total: Number(countRows[0]?.TOTAL ?? 0),
    };
  }
}
