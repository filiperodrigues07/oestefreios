import { apiFetch } from './httpClient.js';
import type { ClienteDTO, ClienteInput, RegimeTributario, TipoPessoa } from '../types/cherp.types.js';

interface PaginatedClientes {
  items: ClienteDTO[];
  page: number;
  limit: number;
  total: number;
}

export type ClienteSortBy = 'codigo' | 'nome' | 'documento' | 'telefone' | 'cidade';

export interface ClientesFiltro {
  tipoPessoa?: TipoPessoa;
  uf?: string;
  sortBy?: ClienteSortBy;
  sortOrder?: 'asc' | 'desc';
}

/** Busca livre (termo casa contra código, nome/razão social, documento, telefone/celular no backend)
 *  — sem termo digitado (F8/campo vazio), devolve a primeira página em vez de exigir digitação. */
export function searchClientes(
  query: string,
  page = 1,
  limit = 10,
  filtro: ClientesFiltro = {},
): Promise<PaginatedClientes> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const termo = query.trim();
  if (termo.length > 0) params.set('busca', termo);
  if (filtro.tipoPessoa) params.set('tipoPessoa', filtro.tipoPessoa);
  if (filtro.uf) params.set('uf', filtro.uf);
  if (filtro.sortBy) params.set('sortBy', filtro.sortBy);
  if (filtro.sortOrder) params.set('sortOrder', filtro.sortOrder);
  return apiFetch<PaginatedClientes>(`/clientes?${params.toString()}`);
}

export function getClienteByCodigo(codigo: string): Promise<ClienteDTO> {
  return apiFetch<ClienteDTO>(`/clientes/${codigo}`);
}

export function getClienteByDocumento(documento: string): Promise<ClienteDTO | null> {
  return apiFetch<ClienteDTO | null>(`/clientes/documento/${documento.replace(/\D/g, '')}`);
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

export interface CepLookupResult {
  cep: string;
  endereco?: string;
  bairro?: string;
  cidade: string;
  uf: string;
}

export function consultarCep(cep: string): Promise<CepLookupResult> {
  return apiFetch<CepLookupResult>(`/clientes/cep/${cep}`);
}

export interface InscricaoEstadualLookupResult {
  numero: string;
  ativo: boolean;
  uf: string;
  atualizadoEm?: string;
}

/** SINTEGRA Brasil (Onda 3) — sem chave configurada, o backend devolve lista vazia, nunca erro. */
export function consultarInscricaoEstadual(cnpj: string): Promise<InscricaoEstadualLookupResult[]> {
  return apiFetch<InscricaoEstadualLookupResult[]>(`/clientes/inscricao-estadual/${cnpj}`);
}

export function excluirCliente(codigo: string, motivo: string): Promise<null> {
  // queueOffline: false — excluir enfileirado offline poderia rodar depois, num cadastro já reaproveitado.
  return apiFetch<null>(`/clientes/${codigo}`, { method: 'DELETE', body: { motivo }, queueOffline: false });
}
