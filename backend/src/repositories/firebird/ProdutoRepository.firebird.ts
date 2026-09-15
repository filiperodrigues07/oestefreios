import { firebirdQuery } from '../../database/firebird/pool.js';
import { NotImplementedError } from '../../errors/NotImplementedError.js';
import type { PaginatedResult, Produto, SearchQuery } from '../../types/cherp.types.js';
import type { IProdutoRepository } from '../interfaces/IProdutoRepository.js';

/**
 * Implementação real contra o Firebird/CHERP. Preencha as constantes de SQL abaixo
 * com as queries reais fornecidas pelo time do CHERP — ver database/queries/CONTRATO.md
 * para os campos que cada método precisa devolver. Enquanto `null`, cada método
 * lança NotImplementedError (HTTP 501) em vez de silenciosamente devolver lixo.
 *
 * Depois de preencher, troque CHERP_MODE=firebird no .env — nenhum controller,
 * service ou DTO precisa mudar (repositories/index.ts já resolve pela env).
 */

// TODO(Fase 5): query real. Deve devolver 1 linha com CODIGO, DESCRICAO, UNIDADE,
// DISPONIVEL, PRECO_UNITARIO, CUSTO (nomes de coluna exemplificativos — ajuste ao schema real).
const QUERY_BUSCAR_POR_CODIGO: string | null = null;

// TODO(Fase 5): query real com LIKE/CONTAINING sobre a descrição.
const QUERY_BUSCAR_POR_DESCRICAO: string | null = null;

// TODO(Fase 5): query real com paginação (FIRST/SKIP ou ROWS) e filtro opcional por código/descrição.
const QUERY_BUSCAR_PAGINADO: string | null = null;
const QUERY_CONTAR_TOTAL: string | null = null;

function mapRowToProduto(row: Record<string, unknown>): Produto {
  return {
    // CHERP usa códigos com zeros à esquerda — nunca converter para number (ver seção 36 do briefing).
    codigo: String(row.CODIGO ?? row.codigo),
    descricao: String(row.DESCRICAO ?? row.descricao),
    unidade: String(row.UNIDADE ?? row.unidade),
    disponivel: row.DISPONIVEL !== undefined ? Number(row.DISPONIVEL) : undefined,
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
    const rows = await firebirdQuery(QUERY_BUSCAR_POR_DESCRICAO, [`%${descricao}%`]);
    return rows.map(mapRowToProduto);
  }

  async buscar(query: SearchQuery): Promise<PaginatedResult<Produto>> {
    if (!QUERY_BUSCAR_PAGINADO || !QUERY_CONTAR_TOTAL) throw new NotImplementedError('ProdutoRepository.buscar');
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [rows, countRows] = await Promise.all([
      firebirdQuery(QUERY_BUSCAR_PAGINADO, [query.codigo ?? null, query.descricao ? `%${query.descricao}%` : null, skip, limit]),
      firebirdQuery<{ TOTAL: number }>(QUERY_CONTAR_TOTAL, [query.codigo ?? null, query.descricao ? `%${query.descricao}%` : null]),
    ]);

    return {
      items: rows.map(mapRowToProduto),
      page,
      limit,
      total: Number(countRows[0]?.TOTAL ?? 0),
    };
  }
}
