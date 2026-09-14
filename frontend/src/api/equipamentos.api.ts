import { apiFetch } from './httpClient.js';
import type { EquipamentoDTO } from '../types/cherp.types.js';

interface PaginatedEquipamentos {
  items: EquipamentoDTO[];
  page: number;
  limit: number;
  total: number;
}

/** Busca equipamento por código/descrição, sempre restrito ao cliente já selecionado (seção 8). */
export function searchEquipamentos(query: string, clienteCodigo: string): Promise<PaginatedEquipamentos> {
  const isCodigo = /^[A-Za-z0-9]+$/.test(query) && !/\s/.test(query);
  const params = new URLSearchParams({
    [isCodigo ? 'codigo' : 'descricao']: query,
    clienteCodigo,
    limit: '10',
  });
  return apiFetch<PaginatedEquipamentos>(`/equipamentos?${params.toString()}`);
}

export function getEquipamentoByCodigo(codigo: string): Promise<EquipamentoDTO> {
  return apiFetch<EquipamentoDTO>(`/equipamentos/${codigo}`);
}
