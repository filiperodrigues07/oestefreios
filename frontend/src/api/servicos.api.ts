import { buildCatalogParams, type CatalogParams } from './catalog.types.js';
import { apiFetch } from './httpClient.js';
import type { ServicoDTO } from '../types/cherp.types.js';

interface PaginatedServicos {
  items: ServicoDTO[];
  page: number;
  limit: number;
  total: number;
}

/** Sem termo digitado (F8/campo vazio), devolve a primeira página do catálogo em vez de exigir digitação. */
export function searchServicos(query: string): Promise<PaginatedServicos> {
  const params = new URLSearchParams({ limit: '10' });
  const termo = query.trim();
  if (termo.length > 0) {
    const isCodigo = /^\d+$/.test(termo);
    params.set(isCodigo ? 'codigo' : 'descricao', termo);
  }
  return apiFetch<PaginatedServicos>(`/servicos?${params.toString()}`);
}

/** Catálogo completo (seção 12 do briefing): lista paginada, com ou sem filtro. */
export function listarServicosCatalogo(params: CatalogParams): Promise<PaginatedServicos> {
  return apiFetch<PaginatedServicos>(`/servicos?${buildCatalogParams(params).toString()}`);
}

/** Busca exata por código (Enter no campo Código do lançamento de itens da OS) — 404 se não existir. */
export function getServicoByCodigo(codigo: string): Promise<ServicoDTO> {
  return apiFetch<ServicoDTO>(`/servicos/${encodeURIComponent(codigo)}`);
}
