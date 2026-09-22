import type { PaginatedResult, Produto, SearchQuery } from '../../types/cherp.types.js';

export interface IProdutoRepository {
  listarTipos(): Promise<{ codigo: number; descricao: string }[]>;
  buscarPorCodigo(codigo: string): Promise<Produto | null>;
  buscarPorDescricao(descricao: string): Promise<Produto[]>;
  buscar(query: SearchQuery): Promise<PaginatedResult<Produto>>;
}
