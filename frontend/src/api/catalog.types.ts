export type CatalogSortBy = 'codigo' | 'descricao' | 'categoria' | 'tipo';

export interface CatalogParams {
  /** Busca livre — casa contra código, descrição ou categoria de uma vez (backend faz o OR). */
  filtro?: string;
  page?: number;
  limit?: number;
  sortBy?: CatalogSortBy;
  sortOrder?: 'asc' | 'desc';
}

export function buildCatalogParams(params: CatalogParams): URLSearchParams {
  const usp = new URLSearchParams();
  if (params.filtro) usp.set('busca', params.filtro);
  usp.set('page', String(params.page ?? 1));
  usp.set('limit', String(params.limit ?? 10));
  usp.set('sortBy', params.sortBy ?? 'descricao');
  usp.set('sortOrder', params.sortOrder ?? 'asc');
  return usp;
}
