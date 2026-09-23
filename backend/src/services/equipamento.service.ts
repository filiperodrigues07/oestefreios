import { ConflictError } from '../errors/ConflictError.js';
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

async function checarDuplicidade(input: EquipamentoInput, codigoAtual?: string): Promise<void> {
  const existentePlaca = await equipamentoRepository.buscarPorPlaca(input.placa);
  if (existentePlaca && existentePlaca.codigo !== codigoAtual) {
    throw new ConflictError(
      `A placa "${input.placa}" já pertence a um veículo cadastrado.`,
      'VEHICLE_DUPLICATE',
      { codigo: existentePlaca.codigo, descricao: existentePlaca.descricao, clienteCodigo: existentePlaca.clienteCodigo, clienteNome: existentePlaca.clienteNome },
    );
  }
  if (input.chassi?.trim()) {
    const existenteChassi = await equipamentoRepository.buscarPorChassi(input.chassi);
    if (existenteChassi && existenteChassi.codigo !== codigoAtual) {
      throw new ConflictError(
        `O chassi "${input.chassi}" já pertence a um veículo cadastrado.`,
        'VEHICLE_CHASSIS_DUPLICATE',
        { codigo: existenteChassi.codigo, descricao: existenteChassi.descricao, clienteCodigo: existenteChassi.clienteCodigo, clienteNome: existenteChassi.clienteNome },
      );
    }
  }
}

export async function criarEquipamento(input: EquipamentoInput, usuario: AuthenticatedUser, ctx: RequestContext = {}): Promise<Equipamento> {
  await checarDuplicidade(input);
  const equipamento = await equipamentoRepository.criar(input);
  await auditEquipamento('VEICULO_CREATED', equipamento.codigo, usuario, ctx, { after: equipamento });
  return equipamento;
}

export async function atualizarEquipamento(codigo: string, input: EquipamentoInput, usuario: AuthenticatedUser, ctx: RequestContext = {}): Promise<Equipamento> {
  const before = await getEquipamentoByCodigo(codigo);
  await checarDuplicidade(input, codigo);
  const equipamento = await equipamentoRepository.atualizar(codigo, input);
  await auditEquipamento('VEICULO_UPDATED', codigo, usuario, ctx, { before, after: equipamento });
  return equipamento;
}
