import { NotFoundError } from '../errors/NotFoundError.js';
import { clienteRepository } from '../repositories/index.js';
import { lookupCnpj, type CnpjLookupResult } from './cnpj.service.js';
import type { Cliente, ClienteInput, PaginatedResult, SearchQuery } from '../types/cherp.types.js';
import { lookupCep } from './cep.service.js';
import type { AuthenticatedUser } from '../types/auth.types.js';

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

export async function criarCliente(input: ClienteInput, usuario: AuthenticatedUser): Promise<Cliente> {
  return clienteRepository.criar({ ...input, cherpUsuarioChave: usuario.cherpUsuarioChave });
}

export async function consultarCep(cep: string) {
  return lookupCep(cep);
}

export async function atualizarCliente(codigo: string, input: ClienteInput): Promise<Cliente> {
  return clienteRepository.atualizar(codigo, input);
}

export async function consultarCnpj(cnpj: string): Promise<CnpjLookupResult> {
  return lookupCnpj(cnpj);
}
