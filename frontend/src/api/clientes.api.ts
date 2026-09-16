import { apiFetch } from './httpClient.js';
import type { ClienteDTO, ClienteInput, RegimeTributario, TipoPessoa } from '../types/cherp.types.js';

interface PaginatedClientes {
  items: ClienteDTO[];
  page: number;
  limit: number;
  total: number;
}

export interface ClientesFiltro {
  tipoPessoa?: TipoPessoa;
  uf?: string;
}

/** Sem termo digitado (F8/campo vazio), devolve a primeira página em vez de exigir digitação. */
export function searchClientes(
  query: string,
  page = 1,
  limit = 10,
  filtro: ClientesFiltro = {},
): Promise<PaginatedClientes> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const termo = query.trim();
  if (termo.length > 0) {
    const isCodigo = /^\d+$/.test(termo);
    params.set(isCodigo ? 'codigo' : 'descricao', termo);
  }
  if (filtro.tipoPessoa) params.set('tipoPessoa', filtro.tipoPessoa);
  if (filtro.uf) params.set('uf', filtro.uf);
  return apiFetch<PaginatedClientes>(`/clientes?${params.toString()}`);
}

export function getClienteByCodigo(codigo: string): Promise<ClienteDTO> {
  return apiFetch<ClienteDTO>(`/clientes/${codigo}`);
}

export function criarCliente(input: ClienteInput): Promise<ClienteDTO> {
  return apiFetch<ClienteDTO>('/clientes', { method: 'POST', body: input });
}

export function atualizarCliente(codigo: string, input: ClienteInput): Promise<ClienteDTO> {
  return apiFetch<ClienteDTO>(`/clientes/${codigo}`, { method: 'PUT', body: input });
}

export interface CnpjLookupResult {
  razaoSocial: string;
  nomeFantasia?: string;
  situacaoCadastral?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  regimeTributario?: RegimeTributario;
}

export function consultarCnpj(cnpj: string): Promise<CnpjLookupResult> {
  return apiFetch<CnpjLookupResult>(`/clientes/cnpj/${cnpj}`);
}
