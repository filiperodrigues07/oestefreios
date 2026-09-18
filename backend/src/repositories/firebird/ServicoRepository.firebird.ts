import { firebirdQuery } from '../../database/firebird/pool.js';
import { toLatin1SearchParam } from '../../database/firebird/encoding.js';
import { NotImplementedError } from '../../errors/NotImplementedError.js';
import type { PaginatedResult, SearchQuery, Servico } from '../../types/cherp.types.js';
import type { IServicoRepository } from '../interfaces/IServicoRepository.js';

/**
 * Ver ProdutoRepository.firebird.ts para o padrão geral e para a explicação do
 * charset (CAST ... OCTETS + toLatin1Param). Serviços moram na mesma tabela
 * PRODUTO do produto, só que com TIPO = 9 (PRODUTOTIPO.CODIGO = 9 "SERVIÇOS").
 * Categoria vem de GRUPOPRODUTO via CHAVEGRUPO, igual produto. CHERP não tem
 * campo de "tempo estimado" pra serviço nesse schema — fora do contrato.
 */

const SERVICO_SELECT = `
  P.CODIGO AS CODIGO,
  CAST(P.DESCRICAO AS VARCHAR(100) CHARACTER SET OCTETS) AS DESCRICAO,
  U.UNMAIOR AS UNIDADE,
  CAST(G.DESCRICAO AS VARCHAR(100) CHARACTER SET OCTETS) AS CATEGORIA,
  PV.PRECOVENDA AS VALOR_UNITARIO
FROM PRODUTO P
LEFT JOIN UNIDADE U ON U.CHAVE = P.CHAVEUNIDADE
LEFT JOIN GRUPOPRODUTO G ON G.CHAVE = P.CHAVEGRUPO
LEFT JOIN PRODUTOVENDA PV ON PV.CHAVE = (
  SELECT FIRST 1 PV2.CHAVE FROM PRODUTOVENDA PV2
  WHERE PV2.CHAVEPRODUTO = P.CHAVE AND PV2.ATIVO = 1
  ORDER BY PV2.CHAVETABELAPRECO
)`;

// TRIM LEADING '0' em ambos os lados: código real é zero-padded (ex. "000320") mas o usuário
// digita sem os zeros na busca exata (ex. "320") — comparar ignorando os zeros à esquerda.
const QUERY_BUSCAR_POR_CODIGO: string | null = `
  SELECT ${SERVICO_SELECT}
  WHERE P.ATIVO = 1 AND P.TIPO = 9 AND TRIM(LEADING '0' FROM P.CODIGO) = TRIM(LEADING '0' FROM ?)
`;

const QUERY_BUSCAR_POR_DESCRICAO: string | null = `
  SELECT ${SERVICO_SELECT}
  WHERE P.ATIVO = 1 AND P.TIPO = 9 AND UPPER(P.DESCRICAO) LIKE ?
`;

// Busca livre — mesmo padrão unificado de OS/Clientes/Produtos: um termo só casa contra código,
// descrição ou categoria de uma vez (OR). CODIGO por LIKE — ver ProdutoRepository.firebird.ts.
const BUSCA_CONDICAO = `
  (
    ? IS NULL OR (
      UPPER(CAST(P.CODIGO AS VARCHAR(50))) LIKE ?
      OR UPPER(P.DESCRICAO) LIKE ?
      OR UPPER(G.DESCRICAO) LIKE ?
    )
  )
`;

// Parâmetros: limit, skip, busca|null x4 (ver buscar() abaixo). Sem ORDER BY fixo — buscar()
// completa com a coluna/direção validadas pelo zod (sortBy/sortOrder).
const QUERY_BUSCAR_PAGINADO_BASE: string | null = `
  SELECT FIRST ? SKIP ? ${SERVICO_SELECT}
  WHERE P.ATIVO = 1 AND P.TIPO = 9
    AND ${BUSCA_CONDICAO}
`;

const QUERY_CONTAR_TOTAL: string | null = `
  SELECT COUNT(*) AS TOTAL
  FROM PRODUTO P
  LEFT JOIN GRUPOPRODUTO G ON G.CHAVE = P.CHAVEGRUPO
  WHERE P.ATIVO = 1 AND P.TIPO = 9
    AND ${BUSCA_CONDICAO}
`;

/** sortBy/sortOrder já vêm validados por enum no zod (search.validator.ts) — seguro interpolar direto. */
function buildOrderBy(query: SearchQuery): string {
  const coluna = query.sortBy === 'codigo' ? 'P.CODIGO' : query.sortBy === 'categoria' ? 'G.DESCRICAO' : 'P.DESCRICAO';
  const direcao = query.sortOrder === 'desc' ? 'DESC' : 'ASC';
  return `${coluna} ${direcao}`;
}

function mapRowToServico(row: Record<string, unknown>): Servico {
  return {
    codigo: String(row.CODIGO ?? row.codigo),
    descricao: String(row.DESCRICAO ?? row.descricao),
    unidade: String(row.UNIDADE ?? row.unidade),
    categoria: row.CATEGORIA ? String(row.CATEGORIA) : undefined,
    valorUnitario: row.VALOR_UNITARIO !== undefined ? Number(row.VALOR_UNITARIO) : undefined,
  };
}

export class ServicoRepositoryFirebird implements IServicoRepository {
  async buscarPorCodigo(codigo: string): Promise<Servico | null> {
    if (!QUERY_BUSCAR_POR_CODIGO) throw new NotImplementedError('ServicoRepository.buscarPorCodigo');
    const rows = await firebirdQuery(QUERY_BUSCAR_POR_CODIGO, [codigo.trim()]);
    return rows[0] ? mapRowToServico(rows[0]) : null;
  }

  async buscarPorDescricao(descricao: string): Promise<Servico[]> {
    if (!QUERY_BUSCAR_POR_DESCRICAO) throw new NotImplementedError('ServicoRepository.buscarPorDescricao');
    const rows = await firebirdQuery(QUERY_BUSCAR_POR_DESCRICAO, [toLatin1SearchParam(descricao)]);
    return rows.map(mapRowToServico);
  }

  async buscar(query: SearchQuery): Promise<PaginatedResult<Servico>> {
    if (!QUERY_BUSCAR_PAGINADO_BASE || !QUERY_CONTAR_TOTAL) throw new NotImplementedError('ServicoRepository.buscar');
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const termo = query.busca ?? query.codigo ?? query.descricao ?? null;
    const buscaFlag = termo ? termo.trim() : null;
    const buscaCodigoLike = buscaFlag ? Buffer.from(`%${buscaFlag.toUpperCase().replace(/[^A-Z0-9]/g, '')}%`, 'latin1') : null;
    const buscaTextoLike = buscaFlag ? toLatin1SearchParam(buscaFlag) : null;
    const buscaParams = [buscaFlag, buscaCodigoLike, buscaTextoLike, buscaTextoLike];
    const queryPaginada = `${QUERY_BUSCAR_PAGINADO_BASE} ORDER BY ${buildOrderBy(query)}`;

    const [rows, countRows] = await Promise.all([
      firebirdQuery(queryPaginada, [limit, skip, ...buscaParams]),
      firebirdQuery<{ TOTAL: number }>(QUERY_CONTAR_TOTAL, buscaParams),
    ]);

    return { items: rows.map(mapRowToServico), page, limit, total: Number(countRows[0]?.TOTAL ?? 0) };
  }
}
