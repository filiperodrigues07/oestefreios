import { ConflictError } from '../errors/ConflictError.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { clienteRepository } from '../repositories/index.js';
import { lookupCnpj, type CnpjLookupResult } from './cnpj.service.js';
import type { Cliente, ClienteInput, PaginatedResult, SearchQuery } from '../types/cherp.types.js';
import { lookupCep } from './cep.service.js';
import { consultarInscricaoEstadual as lookupInscricaoEstadual, type InscricaoEstadualLookupResult } from './inscricaoEstadual.service.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import type { RequestContext } from '../utils/requestContext.js';
import { descreverVinculos, temVinculos } from '../utils/vinculos.js';
import { recordAudit } from './auditLog.service.js';

function auditCliente(event: string, codigo: string, usuario: AuthenticatedUser, ctx: RequestContext, changes: unknown) {
  return recordAudit({ userId: usuario.id, userName: usuario.name, event, entityType: 'CLIENTE', entityId: codigo, changes, ...ctx });
}

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

export async function getClienteByDocumento(documento: string): Promise<Cliente | null> {
  return clienteRepository.buscarPorDocumento(documento);
}

export async function criarCliente(input: ClienteInput, usuario: AuthenticatedUser, ctx: RequestContext = {}): Promise<Cliente> {
  const existente = await clienteRepository.buscarPorDocumento(input.documento);
  if (existente) {
    throw new ConflictError(
      `Já existe um cliente cadastrado com o documento "${input.documento}".`,
      'CLIENT_DUPLICATE',
      { codigo: existente.codigo, nome: existente.nome },
    );
  }
  const cliente = await clienteRepository.criar({ ...input, cherpUsuarioChave: usuario.cherpUsuarioChave });
  await auditCliente('CLIENTE_CREATED', cliente.codigo, usuario, ctx, { after: cliente });
  return cliente;
}

export async function consultarCep(cep: string) {
  return lookupCep(cep);
}

export async function atualizarCliente(codigo: string, input: ClienteInput, usuario: AuthenticatedUser, ctx: RequestContext = {}): Promise<Cliente> {
  const before = await getClienteByCodigo(codigo);
  const cliente = await clienteRepository.atualizar(codigo, input);
  await auditCliente('CLIENTE_UPDATED', codigo, usuario, ctx, { before, after: cliente });
  return cliente;
}

/**
 * Exclusão lógica do cliente (ATIVO = 0) — some das telas mas o histórico do CHERP fica intacto.
 * Bloqueia se houver OS, veículos ou movimentação no CHERP; o motivo e uma foto do cadastro vão pra auditoria.
 */
export async function excluirCliente(codigo: string, motivo: string, usuario: AuthenticatedUser, ctx: RequestContext = {}): Promise<void> {
  const cliente = await getClienteByCodigo(codigo);
  const excluido = await clienteRepository.excluir(codigo);
  if (!excluido) {
    const vinculos = await clienteRepository.contarVinculos(codigo);
    if (temVinculos(vinculos)) throw new ConflictError(descreverVinculos(vinculos, 'cliente'), 'CLIENT_HAS_LINKS', vinculos);
    throw new NotFoundError(`Cliente com código "${codigo}" não encontrado.`, 'CLIENT_NOT_FOUND');
  }
  await auditCliente('CLIENTE_DELETED', codigo, usuario, ctx, {
    motivo,
    before: { codigo: cliente.codigo, nome: cliente.nome, documento: cliente.documento, tipoPessoa: cliente.tipoPessoa, cidade: cliente.cidade, uf: cliente.uf },
  });
}

export async function consultarCnpj(cnpj: string): Promise<CnpjLookupResult> {
  return lookupCnpj(cnpj);
}

export async function consultarInscricaoEstadual(cnpj: string): Promise<InscricaoEstadualLookupResult[]> {
  return lookupInscricaoEstadual(cnpj);
}
