import type { Equipamento, PaginatedResult, SearchQuery } from '../../types/cherp.types.js';

export interface IEquipamentoRepository {
  buscarPorCodigo(codigo: string): Promise<Equipamento | null>;
  buscarPorCliente(clienteCodigo: string): Promise<Equipamento[]>;
  buscar(query: SearchQuery): Promise<PaginatedResult<Equipamento>>;
}
