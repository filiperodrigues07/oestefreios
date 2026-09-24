import type { Equipamento, EquipamentoInput, PaginatedResult, SearchQuery, VinculosCadastro } from '../../types/cherp.types.js';

export interface IEquipamentoRepository {
  buscarPorCodigo(codigo: string): Promise<Equipamento | null>;
  buscarPorCliente(clienteCodigo: string): Promise<Equipamento[]>;
  buscarPorPlaca(placa: string): Promise<Equipamento | null>;
  buscarPorChassi(chassi: string): Promise<Equipamento | null>;
  buscar(query: SearchQuery): Promise<PaginatedResult<Equipamento>>;
  criar(input: EquipamentoInput): Promise<Equipamento>;
  atualizar(codigo: string, input: EquipamentoInput): Promise<Equipamento>;
  /** Exclusão lógica (ATIVO = 0). Devolve false, sem alterar nada, se houver OS vinculada ou o cadastro já não existir. */
  excluir(codigo: string): Promise<boolean>;
  contarVinculos(codigo: string): Promise<VinculosCadastro>;
}
