import type { Equipamento, EquipamentoInput, PaginatedResult, SearchQuery } from '../../types/cherp.types.js';

export interface IEquipamentoRepository {
  buscarPorCodigo(codigo: string): Promise<Equipamento | null>;
  buscarPorCliente(clienteCodigo: string): Promise<Equipamento[]>;
  buscarPorPlaca(placa: string): Promise<Equipamento | null>;
  buscar(query: SearchQuery): Promise<PaginatedResult<Equipamento>>;
  criar(input: EquipamentoInput): Promise<Equipamento>;
  atualizar(codigo: string, input: EquipamentoInput): Promise<Equipamento>;
}
