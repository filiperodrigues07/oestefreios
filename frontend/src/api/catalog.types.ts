export interface CatalogParams {
  /** Busca livre — vira `codigo` se for só dígitos, senão `descricao` (mesma regra do combobox). */
  filtro?: string;
  page?: number;
  limit?: number;
  sortBy?: 'codigo' | 'descricao';
  sortOrder?: 'asc' | 'desc';
}

export function buildCatalogParams(params: CatalogParams): URLSearchParams {
  const usp = new URLSearchParams();
  if (params.filtro) {
    const isCodigo = /^\d+$/.test(params.filtro);
    usp.set(isCodigo ? 'codigo' : 'descricao', params.filtro);
  }
  usp.set('page', String(params.page ?? 1));
  usp.set('limit', String(params.limit ?? 10));
  usp.set('sortBy', params.sortBy ?? 'descricao');
  usp.set('sortOrder', params.sortOrder ?? 'asc');
  return usp;
}
