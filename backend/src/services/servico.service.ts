import { toServicoDTO } from '../dto/mappers/servico.mapper.js';
import type { AdminServicoDTO, OperationalServicoDTO } from '../dto/servico.dto.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { servicoRepository } from '../repositories/index.js';
import type { Permission } from '../types/auth.types.js';
import type { PaginatedResult, SearchQuery } from '../types/cherp.types.js';

export async function listarTiposServicos(): Promise<{ codigo: string; descricao: string }[]> {
  return servicoRepository.listarTipos();
}

export async function searchServicos(
  query: SearchQuery,
  permissions: Permission[],
): Promise<PaginatedResult<OperationalServicoDTO | AdminServicoDTO>> {
  const result = await servicoRepository.buscar(query);
  return { ...result, items: result.items.map((s) => toServicoDTO(s, permissions)) };
}

export async function getServicoByCodigo(
  codigo: string,
  permissions: Permission[],
): Promise<OperationalServicoDTO | AdminServicoDTO> {
  const servico = await servicoRepository.buscarPorCodigo(codigo);
  if (!servico) {
    throw new NotFoundError(`Serviço com código "${codigo}" não encontrado.`, 'SERVICE_NOT_FOUND');
  }
  return toServicoDTO(servico, permissions);
}
