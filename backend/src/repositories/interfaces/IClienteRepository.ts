import type { Cliente, PaginatedResult, SearchQuery } from '../../types/cherp.types.js';

export interface IClienteRepository {
  buscarPorCodigo(codigo: string): Promise<Cliente | null>;
  buscarPorNome(nome: string): Promise<Cliente[]>;
  buscar(query: SearchQuery): Promise<PaginatedResult<Cliente>>;
}
