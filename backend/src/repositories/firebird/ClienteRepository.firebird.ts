import { firebirdQuery } from '../../database/firebird/pool.js';
import { NotImplementedError } from '../../errors/NotImplementedError.js';
import type { Cliente, PaginatedResult, SearchQuery } from '../../types/cherp.types.js';
import type { IClienteRepository } from '../interfaces/IClienteRepository.js';

/** Ver ProdutoRepository.firebird.ts para o padrão geral (placeholder + guarda). */

// TODO(Fase 5): deve devolver CODIGO, NOME, DOCUMENTO, TELEFONE (nomes exemplificativos).
const QUERY_BUSCAR_POR_CODIGO: string | null = null;
const QUERY_BUSCAR_POR_NOME: string | null = null;
const QUERY_BUSCAR_PAGINADO: string | null = null;
const QUERY_CONTAR_TOTAL: string | null = null;

function mapRowToCliente(row: Record<string, unknown>): Cliente {
  return {
    codigo: String(row.CODIGO ?? row.codigo),
    nome: String(row.NOME ?? row.nome),
    documento: row.DOCUMENTO !== undefined ? String(row.DOCUMENTO) : undefined,
    telefone: row.TELEFONE !== undefined ? String(row.TELEFONE) : undefined,
  };
}

export class ClienteRepositoryFirebird implements IClienteRepository {
  async buscarPorCodigo(codigo: string): Promise<Cliente | null> {
    if (!QUERY_BUSCAR_POR_CODIGO) throw new NotImplementedError('ClienteRepository.buscarPorCodigo');
    const rows = await firebirdQuery(QUERY_BUSCAR_POR_CODIGO, [codigo]);
    return rows[0] ? mapRowToCliente(rows[0]) : null;
  }

  async buscarPorNome(nome: string): Promise<Cliente[]> {
    if (!QUERY_BUSCAR_POR_NOME) throw new NotImplementedError('ClienteRepository.buscarPorNome');
    const rows = await firebirdQuery(QUERY_BUSCAR_POR_NOME, [`%${nome}%`]);
    return rows.map(mapRowToCliente);
  }

  async buscar(query: SearchQuery): Promise<PaginatedResult<Cliente>> {
    if (!QUERY_BUSCAR_PAGINADO || !QUERY_CONTAR_TOTAL) throw new NotImplementedError('ClienteRepository.buscar');
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [rows, countRows] = await Promise.all([
      firebirdQuery(QUERY_BUSCAR_PAGINADO, [query.codigo ?? null, query.descricao ? `%${query.descricao}%` : null, skip, limit]),
      firebirdQuery<{ TOTAL: number }>(QUERY_CONTAR_TOTAL, [query.codigo ?? null, query.descricao ? `%${query.descricao}%` : null]),
    ]);

    return { items: rows.map(mapRowToCliente), page, limit, total: Number(countRows[0]?.TOTAL ?? 0) };
  }
}
