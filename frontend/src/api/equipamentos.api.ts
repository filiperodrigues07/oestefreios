import { apiFetch } from './httpClient.js';
import type { EquipamentoDTO, EquipamentoInput } from '../types/cherp.types.js';

interface PaginatedEquipamentos {
  items: EquipamentoDTO[];
  page: number;
  limit: number;
  total: number;
}

export type EquipamentoSortBy = 'codigo' | 'identificacao' | 'descricao' | 'ano' | 'cliente';

export function listarEquipamentos(
  busca: string,
  page: number,
  limit: number,
  clienteCodigo?: string,
  sortBy?: EquipamentoSortBy,
  sortOrder: 'asc' | 'desc' = 'asc',
  anoFabricacao?: number,
): Promise<PaginatedEquipamentos> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (busca.trim()) params.set('descricao', busca.trim());
  if (clienteCodigo) params.set('clienteCodigo', clienteCodigo);
  if (anoFabricacao) params.set('anoFabricacao', String(anoFabricacao));
  if (sortBy) params.set('sortBy', sortBy);
  params.set('sortOrder', sortOrder);
  return apiFetch<PaginatedEquipamentos>(`/equipamentos?${params.toString()}`);
}

/**
 * Busca equipamento por código/descrição, sempre restrito ao cliente já selecionado (seção 8).
 * Sem termo digitado, devolve todos os equipamentos do cliente (lista costuma ser curta —
 * poucos veículos por cliente) em vez de exigir digitação antes de mostrar algo.
 */
export function searchEquipamentos(
  query: string,
  clienteCodigo: string,
): Promise<PaginatedEquipamentos> {
  const params = new URLSearchParams({ clienteCodigo, limit: '10' });
  const termo = query.trim();
  if (termo.length > 0) {
    const isCodigo = /^[A-Za-z0-9]+$/.test(termo);
    params.set(isCodigo ? 'codigo' : 'descricao', termo);
  }
  return apiFetch<PaginatedEquipamentos>(`/equipamentos?${params.toString()}`);
}

/**
 * Busca veículo por placa em todo o CHERP, sem restringir a um cliente — fluxo placa-primeiro
 * da OS (usuário digita a placa antes de saber quem é o cliente). Sempre manda como `descricao`
 * (nunca `codigo`): placa não é o código interno do CHERP, e o backend já compara `descricao`
 * contra DESCRICAO *e* IDENTIFICACAO (coluna real da placa) — ver EquipamentoRepository.firebird.ts.
 */
export function searchEquipamentosPorPlaca(placa: string): Promise<PaginatedEquipamentos> {
  const params = new URLSearchParams({ descricao: placa.trim(), limit: '10' });
  return apiFetch<PaginatedEquipamentos>(`/equipamentos?${params.toString()}`);
}

export function getEquipamentoByCodigo(codigo: string): Promise<EquipamentoDTO> {
  return apiFetch<EquipamentoDTO>(`/equipamentos/${codigo}`);
}

export function criarEquipamento(input: EquipamentoInput): Promise<EquipamentoDTO> {
  return apiFetch<EquipamentoDTO>('/equipamentos', { method: 'POST', body: input });
}

export function atualizarEquipamento(
  codigo: string,
  input: EquipamentoInput,
): Promise<EquipamentoDTO> {
  return apiFetch<EquipamentoDTO>(`/equipamentos/${codigo}`, { method: 'PUT', body: input });
}

export interface VehicleLookupQuota {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  period: string;
  exhausted: boolean;
}

export interface VehicleLookupResult {
  plate: string;
  brand?: string;
  model?: string;
  version?: string;
  manufactureYear?: number;
  modelYear?: number;
  color?: string;
  fuel?: string;
  city?: string;
  state?: string;
  engine?: string;
  fipeCode?: string;
}

export type VehicleLookupResponse =
  | { source: 'provider' | 'cache'; vehicle: VehicleLookupResult; quota: VehicleLookupQuota }
  | { source: 'existing'; existingVehicle: EquipamentoDTO; quota: VehicleLookupQuota };

export function getVehicleLookupQuota(): Promise<VehicleLookupQuota> {
  return apiFetch('/equipamentos/lookup/quota');
}

export function lookupVehiclePlate(plate: string): Promise<VehicleLookupResponse> {
  return apiFetch('/equipamentos/lookup', { method: 'POST', body: { plate }, queueOffline: false });
}
