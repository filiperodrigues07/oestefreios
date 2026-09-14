import { toOSDTO } from '../dto/mappers/os.mapper.js';
import type { AdminOSDTO, OperationalOSDTO } from '../dto/os.dto.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { osRepository } from '../repositories/index.js';
import type { OSListFilter } from '../repositories/interfaces/IOSRepository.js';
import type { Permission } from '../types/auth.types.js';

export async function listOS(
  filter: OSListFilter,
  permissions: Permission[],
): Promise<{ items: (OperationalOSDTO | AdminOSDTO)[]; total: number }> {
  const result = await osRepository.listar(filter);
  return { items: result.items.map((os) => toOSDTO(os, permissions)), total: result.total };
}

export async function getOSById(
  id: string,
  permissions: Permission[],
): Promise<OperationalOSDTO | AdminOSDTO> {
  const os = await osRepository.buscarPorId(id);
  if (!os) {
    throw new NotFoundError('Ordem de serviço não encontrada.', 'OS_NOT_FOUND');
  }
  return toOSDTO(os, permissions);
}
