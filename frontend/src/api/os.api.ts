import { apiFetch } from './httpClient.js';
import type { OrdemServicoDTO, OSPrioridade, OSStatus } from '../types/os.types.js';

interface PaginatedOS {
  items: OrdemServicoDTO[];
  total: number;
}

export interface ListarOSFiltro {
  status?: OSStatus;
  clienteCodigo?: string;
  page?: number;
  limit?: number;
}

export function listarOS(filtro: ListarOSFiltro = {}): Promise<PaginatedOS> {
  const params = new URLSearchParams();
  if (filtro.status) params.set('status', filtro.status);
  if (filtro.clienteCodigo) params.set('clienteCodigo', filtro.clienteCodigo);
  params.set('page', String(filtro.page ?? 1));
  params.set('limit', String(filtro.limit ?? 20));
  return apiFetch<PaginatedOS>(`/os?${params.toString()}`);
}

export function getOS(id: string): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>(`/os/${id}`);
}

export interface CriarOSInput {
  clienteCodigo: string;
  equipamentoCodigo: string;
  problema: string;
  prioridade: OSPrioridade;
  responsavelId?: string;
  tecnicoId?: string;
}

export function criarOS(input: CriarOSInput): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>('/os', { method: 'POST', body: input });
}

export interface AtualizarOSInput {
  diagnostico?: string;
  observacoes?: string;
  solucao?: string;
  prioridade?: OSPrioridade;
}

export function atualizarOS(id: string, input: AtualizarOSInput): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>(`/os/${id}`, { method: 'PUT', body: input });
}

export function alterarStatusOS(id: string, status: OSStatus): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>(`/os/${id}/status`, { method: 'PATCH', body: { status } });
}

export function adicionarProdutoOS(id: string, produtoCodigo: string, quantidade: number): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>(`/os/${id}/produtos`, { method: 'POST', body: { produtoCodigo, quantidade } });
}

export function removerProdutoOS(id: string, produtoCodigo: string): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>(`/os/${id}/produtos/${produtoCodigo}`, { method: 'DELETE' });
}

export function adicionarServicoOS(id: string, servicoCodigo: string, quantidade: number): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>(`/os/${id}/servicos`, { method: 'POST', body: { servicoCodigo, quantidade } });
}

export function removerServicoOS(id: string, servicoCodigo: string): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>(`/os/${id}/servicos/${servicoCodigo}`, { method: 'DELETE' });
}
