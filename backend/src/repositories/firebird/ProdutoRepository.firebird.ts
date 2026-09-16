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
  (SELECT SUM(PE.SALDO) FROM PRODUTOESTOQUE PE WHERE PE.CHAVEPRODUTO = P.CHAVE AND PE.ATIVO = 1) AS DISPONIVEL,
  (SELECT FIRST 1 PE2.ESTOQUEMINIMO FROM PRODUTOESTOQUE PE2 WHERE PE2.CHAVEPRODUTO = P.CHAVE AND PE2.ATIVO = 1 ORDER BY PE2.CHAVE) AS ESTOQUE_MINIMO,
  PV.PRECOVENDA AS PRECO_UNITARIO,
  PC.PRECOCUSTO AS CUSTO
FROM PRODUTO P
LEFT JOIN UNIDADE U ON U.CHAVE = P.CHAVEUNIDADE
LEFT JOIN GRUPOPRODUTO G ON G.CHAVE = P.CHAVEGRUPO
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

const QUERY_BUSCAR_POR_CODIGO: string | null = `
  SELECT ${PRODUTO_SELECT}
  WHERE P.ATIVO = 1 AND P.TIPO <> 9 AND P.CODIGO = ?
`;

const QUERY_BUSCAR_POR_DESCRICAO: string | null = `
  SELECT ${PRODUTO_SELECT}
  WHERE P.ATIVO = 1 AND P.TIPO <> 9 AND UPPER(P.DESCRICAO) LIKE ?
`;

// Parâmetros nesta ordem: limit, skip, codigo|null, descricaoLike|null (ver buscar() abaixo).
// Sem ORDER BY fixo — buscar() completa com a coluna/direção validadas pelo zod (sortBy/sortOrder).
// CODIGO por LIKE (não igualdade): usuário digita sem os zeros à esquerda do código real do CHERP
// (ex. "1258" pro código real "001258") — igualdade exata nunca batia, buscar sempre voltava vazio.
const QUERY_BUSCAR_PAGINADO_BASE: string | null = `
  SELECT FIRST ? SKIP ? ${PRODUTO_SELECT}
  WHERE P.ATIVO = 1 AND P.TIPO <> 9
    AND P.CODIGO LIKE COALESCE(?, CAST('%' AS VARCHAR(50) CHARACTER SET OCTETS))
    AND UPPER(P.DESCRICAO) LIKE COALESCE(?, CAST('%' AS VARCHAR(100) CHARACTER SET OCTETS))
`;

const QUERY_CONTAR_TOTAL: string | null = `
  SELECT COUNT(*) AS TOTAL
  FROM PRODUTO P
  WHERE P.ATIVO = 1 AND P.TIPO <> 9
    AND P.CODIGO LIKE COALESCE(?, CAST('%' AS VARCHAR(50) CHARACTER SET OCTETS))
    AND UPPER(P.DESCRICAO) LIKE COALESCE(?, CAST('%' AS VARCHAR(100) CHARACTER SET OCTETS))
`;

/** sortBy/sortOrder já vêm validados por enum no zod (search.validator.ts) — seguro interpolar direto. */
function buildOrderBy(query: SearchQuery): string {
  const coluna = query.sortBy === 'codigo' ? 'P.CODIGO' : 'P.DESCRICAO';
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
    const rows = await firebirdQuery(QUERY_BUSCAR_POR_CODIGO, [codigo]);
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
    const descricaoLike = query.descricao ? toLatin1SearchParam(query.descricao) : null;
    const codigoLike = query.codigo ? `%${query.codigo}%` : null;
    const queryPaginada = `${QUERY_BUSCAR_PAGINADO_BASE} ORDER BY ${buildOrderBy(query)}`;

    const [rows, countRows] = await Promise.all([
      firebirdQuery(queryPaginada, [limit, skip, codigoLike, descricaoLike]),
      firebirdQuery<{ TOTAL: number }>(QUERY_CONTAR_TOTAL, [codigoLike, descricaoLike]),
    ]);

    return {
      items: rows.map(mapRowToProduto),
      page,
      limit,
      total: Number(countRows[0]?.TOTAL ?? 0),
    };
  }
}
