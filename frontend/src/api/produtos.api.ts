import { buildCatalogParams, type CatalogParams } from './catalog.types.js';
import { apiFetch } from './httpClient.js';
import type { ProdutoDTO } from '../types/cherp.types.js';

interface PaginatedProdutos {
  items: ProdutoDTO[];
  page: number;
  limit: number;
  total: number;
}

/**
 * Código informado exatamente (só dígitos) tem prioridade sobre busca por descrição — ver seção 36 do briefing.
 * Sem termo digitado (F8/campo vazio), devolve a primeira página do catálogo em vez de exigir digitação.
 */
export function searchProdutos(query: string): Promise<PaginatedProdutos> {
  const params = new URLSearchParams({ limit: '10' });
  const termo = query.trim();
  if (termo.length > 0) {
    const isCodigo = /^\d+$/.test(termo);
    params.set(isCodigo ? 'codigo' : 'descricao', termo);
  }
  return apiFetch<PaginatedProdutos>(`/produtos?${params.toString()}`);
}

/** Catálogo completo (seção 10 do briefing): lista paginada, com ou sem filtro. */
export function listarProdutosCatalogo(params: CatalogParams): Promise<PaginatedProdutos> {
  return apiFetch<PaginatedProdutos>(`/produtos?${buildCatalogParams(params).toString()}`);
}
