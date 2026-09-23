import type { PaginatedResult, SearchQuery, Servico } from '../../types/cherp.types.js';

export interface IServicoRepository {
  listarTipos(): Promise<{ codigo: string; descricao: string }[]>;
  buscarPorCodigo(codigo: string): Promise<Servico | null>;
  buscarPorDescricao(descricao: string): Promise<Servico[]>;
  buscar(query: SearchQuery): Promise<PaginatedResult<Servico>>;
}
