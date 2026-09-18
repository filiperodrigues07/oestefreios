import type { Permission } from '../../types/auth.types.js';
import type { Produto } from '../../types/cherp.types.js';
import type { AdminProdutoDTO, OperationalProdutoDTO } from '../produto.dto.js';

export function toProdutoDTO(
  produto: Produto,
  permissions: Permission[],
): OperationalProdutoDTO | AdminProdutoDTO {
  const base: OperationalProdutoDTO = {
    codigo: produto.codigo,
    descricao: produto.descricao,
    unidade: produto.unidade,
    categoria: produto.categoria,
    tipo: produto.tipo,
    disponivel: produto.disponivel,
    estoqueMinimo: produto.estoqueMinimo,
  };

  if (!permissions.includes('FINANCIAL_VIEW')) {
    return base;
  }

  const admin: AdminProdutoDTO = {
    ...base,
    precoUnitario: produto.precoUnitario,
    custo: produto.custo,
  };
  return admin;
}
