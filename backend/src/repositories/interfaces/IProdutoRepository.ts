import type { PaginatedResult, Produto, SearchQuery } from '../../types/cherp.types.js';

export interface IProdutoRepository {
  buscarPorCodigo(codigo: string): Promise<Produto | null>;
  buscarPorDescricao(descricao: string): Promise<Produto[]>;
  buscar(query: SearchQuery): Promise<PaginatedResult<Produto>>;
}
