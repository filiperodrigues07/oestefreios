import { apiFetch } from './httpClient.js';
import type { ClienteDTO } from '../types/cherp.types.js';

interface PaginatedClientes {
  items: ClienteDTO[];
  page: number;
  limit: number;
  total: number;
}

export function searchClientes(query: string): Promise<PaginatedClientes> {
  const isCodigo = /^\d+$/.test(query);
  const params = new URLSearchParams({ [isCodigo ? 'codigo' : 'descricao']: query, limit: '10' });
  return apiFetch<PaginatedClientes>(`/clientes?${params.toString()}`);
}

export function getClienteByCodigo(codigo: string): Promise<ClienteDTO> {
  return apiFetch<ClienteDTO>(`/clientes/${codigo}`);
}
