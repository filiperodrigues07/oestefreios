import { NotFoundError } from '../errors/NotFoundError.js';
import { equipamentoRepository } from '../repositories/index.js';
import type { Equipamento, EquipamentoInput, PaginatedResult, SearchQuery } from '../types/cherp.types.js';

export async function searchEquipamentos(query: SearchQuery): Promise<PaginatedResult<Equipamento>> {
  return equipamentoRepository.buscar(query);
}

export async function getEquipamentoByCodigo(codigo: string): Promise<Equipamento> {
  const equipamento = await equipamentoRepository.buscarPorCodigo(codigo);
  if (!equipamento) {
    throw new NotFoundError(`Equipamento com código "${codigo}" não encontrado.`, 'EQUIPMENT_NOT_FOUND');
  }
  return equipamento;
}

export async function listEquipamentosByCliente(clienteCodigo: string): Promise<Equipamento[]> {
  return equipamentoRepository.buscarPorCliente(clienteCodigo);
}

export async function criarEquipamento(input: EquipamentoInput): Promise<Equipamento> {
  return equipamentoRepository.criar(input);
}

export async function atualizarEquipamento(codigo: string, input: EquipamentoInput): Promise<Equipamento> {
  return equipamentoRepository.atualizar(codigo, input);
}
