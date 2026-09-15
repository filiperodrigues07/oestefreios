import { buildCatalogParams, type CatalogParams } from './catalog.types.js';
import { apiFetch } from './httpClient.js';
import type { ProdutoDTO } from '../types/cherp.types.js';

interface PaginatedProdutos {
  items: ProdutoDTO[];
  page: number;
  limit: number;
  total: number;
}

/** Código informado exatamente (só dígitos) tem prioridade sobre busca por descrição — ver seção 36 do briefing. */
export function searchProdutos(query: string): Promise<PaginatedProdutos> {
  const isCodigo = /^\d+$/.test(query);
  const params = new URLSearchParams({ [isCodigo ? 'codigo' : 'descricao']: query, limit: '10' });
  return apiFetch<PaginatedProdutos>(`/produtos?${params.toString()}`);
}

/** Catálogo completo (seção 10 do briefing): lista paginada, com ou sem filtro. */
export function listarProdutosCatalogo(params: CatalogParams): Promise<PaginatedProdutos> {
  return apiFetch<PaginatedProdutos>(`/produtos?${buildCatalogParams(params).toString()}`);
}
