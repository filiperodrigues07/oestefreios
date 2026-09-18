import type { Permission } from '../../types/auth.types.js';
import type { Servico } from '../../types/cherp.types.js';
import type { AdminServicoDTO, OperationalServicoDTO } from '../servico.dto.js';

export function toServicoDTO(
  servico: Servico,
  permissions: Permission[],
): OperationalServicoDTO | AdminServicoDTO {
  const base: OperationalServicoDTO = {
    codigo: servico.codigo,
    descricao: servico.descricao,
    unidade: servico.unidade,
    categoria: servico.categoria,
  };

  if (!permissions.includes('FINANCIAL_VIEW')) {
    return base;
  }

  const admin: AdminServicoDTO = {
    ...base,
    valorUnitario: servico.valorUnitario,
  };
  return admin;
}
