import { toProdutoDTO } from '../dto/mappers/produto.mapper.js';
import type { AdminProdutoDTO, OperationalProdutoDTO } from '../dto/produto.dto.js';
import { produtoRepository } from '../repositories/index.js';
import type { Permission } from '../types/auth.types.js';
import type { PaginatedResult, SearchQuery } from '../types/cherp.types.js';
import { NotFoundError } from '../errors/NotFoundError.js';

export async function searchProdutos(
  query: SearchQuery,
  permissions: Permission[],
): Promise<PaginatedResult<OperationalProdutoDTO | AdminProdutoDTO>> {
  const result = await produtoRepository.buscar(query);
  return { ...result, items: result.items.map((p) => toProdutoDTO(p, permissions)) };
}

export async function getProdutoByCodigo(
  codigo: string,
  permissions: Permission[],
): Promise<OperationalProdutoDTO | AdminProdutoDTO> {
  const produto = await produtoRepository.buscarPorCodigo(codigo);
  if (!produto) {
    throw new NotFoundError(`Produto com código "${codigo}" não encontrado.`, 'PRODUCT_NOT_FOUND');
  }
  return toProdutoDTO(produto, permissions);
}
