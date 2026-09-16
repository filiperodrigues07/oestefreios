import type { Cliente, ClienteInput, PaginatedResult, SearchQuery } from '../../types/cherp.types.js';

export interface IClienteRepository {
  buscarPorCodigo(codigo: string): Promise<Cliente | null>;
  buscarPorNome(nome: string): Promise<Cliente[]>;
  buscar(query: SearchQuery): Promise<PaginatedResult<Cliente>>;
  criar(input: ClienteInput): Promise<Cliente>;
  atualizar(codigo: string, input: ClienteInput): Promise<Cliente>;
}
