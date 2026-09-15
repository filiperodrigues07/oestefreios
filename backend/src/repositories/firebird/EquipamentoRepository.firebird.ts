import { firebirdQuery } from '../../database/firebird/pool.js';
import { NotImplementedError } from '../../errors/NotImplementedError.js';
import type { Equipamento, PaginatedResult, SearchQuery } from '../../types/cherp.types.js';
import type { IEquipamentoRepository } from '../interfaces/IEquipamentoRepository.js';

/** Ver ProdutoRepository.firebird.ts para o padrão geral (placeholder + guarda). */

// TODO(Fase 5): deve devolver CODIGO, DESCRICAO, CLIENTE_CODIGO, IDENTIFICACAO (nomes exemplificativos).
const QUERY_BUSCAR_POR_CODIGO: string | null = null;
const QUERY_BUSCAR_POR_CLIENTE: string | null = null;
const QUERY_BUSCAR_PAGINADO: string | null = null;
const QUERY_CONTAR_TOTAL: string | null = null;

function mapRowToEquipamento(row: Record<string, unknown>): Equipamento {
  return {
    codigo: String(row.CODIGO ?? row.codigo),
    descricao: String(row.DESCRICAO ?? row.descricao),
    clienteCodigo: String(row.CLIENTE_CODIGO ?? row.clienteCodigo),
    identificacao: row.IDENTIFICACAO !== undefined ? String(row.IDENTIFICACAO) : undefined,
  };
}

export class EquipamentoRepositoryFirebird implements IEquipamentoRepository {
  async buscarPorCodigo(codigo: string): Promise<Equipamento | null> {
    if (!QUERY_BUSCAR_POR_CODIGO) throw new NotImplementedError('EquipamentoRepository.buscarPorCodigo');
    const rows = await firebirdQuery(QUERY_BUSCAR_POR_CODIGO, [codigo]);
    return rows[0] ? mapRowToEquipamento(rows[0]) : null;
  }

  async buscarPorCliente(clienteCodigo: string): Promise<Equipamento[]> {
    if (!QUERY_BUSCAR_POR_CLIENTE) throw new NotImplementedError('EquipamentoRepository.buscarPorCliente');
    const rows = await firebirdQuery(QUERY_BUSCAR_POR_CLIENTE, [clienteCodigo]);
    return rows.map(mapRowToEquipamento);
  }

  async buscar(query: SearchQuery): Promise<PaginatedResult<Equipamento>> {
    if (!QUERY_BUSCAR_PAGINADO || !QUERY_CONTAR_TOTAL) throw new NotImplementedError('EquipamentoRepository.buscar');
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const params = [
      query.clienteCodigo ?? null,
      query.codigo ?? null,
      query.descricao ? `%${query.descricao}%` : null,
      skip,
      limit,
    ];

    const [rows, countRows] = await Promise.all([
      firebirdQuery(QUERY_BUSCAR_PAGINADO, params),
      firebirdQuery<{ TOTAL: number }>(QUERY_CONTAR_TOTAL, params.slice(0, 3)),
    ]);

    return { items: rows.map(mapRowToEquipamento), page, limit, total: Number(countRows[0]?.TOTAL ?? 0) };
  }
}
