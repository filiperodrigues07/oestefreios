import { NotFoundError } from '../errors/NotFoundError.js';
import { equipamentoRepository } from '../repositories/index.js';
import type { Equipamento, EquipamentoInput, PaginatedResult, SearchQuery } from '../types/cherp.types.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import type { RequestContext } from '../utils/requestContext.js';
import { recordAudit } from './auditLog.service.js';

function auditEquipamento(event: string, codigo: string, usuario: AuthenticatedUser, ctx: RequestContext, changes: unknown) {
  return recordAudit({ userId: usuario.id, userName: usuario.name, event, entityType: 'VEICULO', entityId: codigo, changes, ...ctx });
}

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

export async function criarEquipamento(input: EquipamentoInput, usuario: AuthenticatedUser, ctx: RequestContext = {}): Promise<Equipamento> {
  const equipamento = await equipamentoRepository.criar(input);
  await auditEquipamento('VEICULO_CREATED', equipamento.codigo, usuario, ctx, { after: equipamento });
  return equipamento;
}

export async function atualizarEquipamento(codigo: string, input: EquipamentoInput, usuario: AuthenticatedUser, ctx: RequestContext = {}): Promise<Equipamento> {
  const before = await getEquipamentoByCodigo(codigo);
  const equipamento = await equipamentoRepository.atualizar(codigo, input);
  await auditEquipamento('VEICULO_UPDATED', codigo, usuario, ctx, { before, after: equipamento });
  return equipamento;
}
