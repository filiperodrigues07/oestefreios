import { firebirdQuery } from '../../database/firebird/pool.js';
import { NotImplementedError } from '../../errors/NotImplementedError.js';
import type { PaginatedResult, SearchQuery, Servico } from '../../types/cherp.types.js';
import type { IServicoRepository } from '../interfaces/IServicoRepository.js';

/** Ver ProdutoRepository.firebird.ts para o padrão geral (placeholder + guarda). */

// TODO(Fase 5): deve devolver CODIGO, DESCRICAO, UNIDADE, VALOR_UNITARIO (nomes exemplificativos).
const QUERY_BUSCAR_POR_CODIGO: string | null = null;
const QUERY_BUSCAR_POR_DESCRICAO: string | null = null;
const QUERY_BUSCAR_PAGINADO: string | null = null;
const QUERY_CONTAR_TOTAL: string | null = null;

function mapRowToServico(row: Record<string, unknown>): Servico {
  return {
    codigo: String(row.CODIGO ?? row.codigo),
    descricao: String(row.DESCRICAO ?? row.descricao),
    unidade: String(row.UNIDADE ?? row.unidade),
    valorUnitario: row.VALOR_UNITARIO !== undefined ? Number(row.VALOR_UNITARIO) : undefined,
  };
}

export class ServicoRepositoryFirebird implements IServicoRepository {
  async buscarPorCodigo(codigo: string): Promise<Servico | null> {
    if (!QUERY_BUSCAR_POR_CODIGO) throw new NotImplementedError('ServicoRepository.buscarPorCodigo');
    const rows = await firebirdQuery(QUERY_BUSCAR_POR_CODIGO, [codigo]);
    return rows[0] ? mapRowToServico(rows[0]) : null;
  }

  async buscarPorDescricao(descricao: string): Promise<Servico[]> {
    if (!QUERY_BUSCAR_POR_DESCRICAO) throw new NotImplementedError('ServicoRepository.buscarPorDescricao');
    const rows = await firebirdQuery(QUERY_BUSCAR_POR_DESCRICAO, [`%${descricao}%`]);
    return rows.map(mapRowToServico);
  }

  async buscar(query: SearchQuery): Promise<PaginatedResult<Servico>> {
    if (!QUERY_BUSCAR_PAGINADO || !QUERY_CONTAR_TOTAL) throw new NotImplementedError('ServicoRepository.buscar');
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [rows, countRows] = await Promise.all([
      firebirdQuery(QUERY_BUSCAR_PAGINADO, [query.codigo ?? null, query.descricao ? `%${query.descricao}%` : null, skip, limit]),
      firebirdQuery<{ TOTAL: number }>(QUERY_CONTAR_TOTAL, [query.codigo ?? null, query.descricao ? `%${query.descricao}%` : null]),
    ]);

    return { items: rows.map(mapRowToServico), page, limit, total: Number(countRows[0]?.TOTAL ?? 0) };
  }
}
