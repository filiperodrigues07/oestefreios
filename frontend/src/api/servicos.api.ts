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
