import { NotFoundError } from '../errors/NotFoundError.js';
import { clienteRepository } from '../repositories/index.js';
import type { Cliente, PaginatedResult, SearchQuery } from '../types/cherp.types.js';

export async function searchClientes(query: SearchQuery): Promise<PaginatedResult<Cliente>> {
  return clienteRepository.buscar(query);
}

export async function getClienteByCodigo(codigo: string): Promise<Cliente> {
  const cliente = await clienteRepository.buscarPorCodigo(codigo);
  if (!cliente) {
    throw new NotFoundError(`Cliente com código "${codigo}" não encontrado.`, 'CLIENT_NOT_FOUND');
  }
  return cliente;
}
