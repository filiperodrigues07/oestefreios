import { buildCatalogParams, type CatalogParams } from './catalog.types.js';
import { apiFetch } from './httpClient.js';
import type { ServicoDTO } from '../types/cherp.types.js';

interface PaginatedServicos {
  items: ServicoDTO[];
  page: number;
  limit: number;
  total: number;
}

export function searchServicos(query: string): Promise<PaginatedServicos> {
  const isCodigo = /^\d+$/.test(query);
  const params = new URLSearchParams({ [isCodigo ? 'codigo' : 'descricao']: query, limit: '10' });
  return apiFetch<PaginatedServicos>(`/servicos?${params.toString()}`);
}

/** Catálogo completo (seção 12 do briefing): lista paginada, com ou sem filtro. */
export function listarServicosCatalogo(params: CatalogParams): Promise<PaginatedServicos> {
  return apiFetch<PaginatedServicos>(`/servicos?${buildCatalogParams(params).toString()}`);
}
