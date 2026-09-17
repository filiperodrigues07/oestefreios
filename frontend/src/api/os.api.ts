import { apiFetch } from './httpClient.js';
import type { OrdemServicoDTO, OSPrioridade, OSStatus } from '../types/os.types.js';

interface PaginatedOS {
  items: OrdemServicoDTO[];
  total: number;
}

export type OSSortBy = 'numero' | 'clienteNome' | 'equipamentoDescricao' | 'dataAbertura' | 'status' | 'prioridade' | 'faturamento';

export interface ListarOSFiltro {
  status?: OSStatus | 'AGUARDANDO';
  clienteCodigo?: string;
  prioridade?: OSPrioridade;
  busca?: string;
  sortBy?: OSSortBy;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export function listarOS(filtro: ListarOSFiltro = {}): Promise<PaginatedOS> {
  const params = new URLSearchParams();
  if (filtro.status) params.set('status', filtro.status);
  if (filtro.clienteCodigo) params.set('clienteCodigo', filtro.clienteCodigo);
  if (filtro.prioridade) params.set('prioridade', filtro.prioridade);
  if (filtro.busca) params.set('busca', filtro.busca);
  if (filtro.sortBy) params.set('sortBy', filtro.sortBy);
  if (filtro.sortOrder) params.set('sortOrder', filtro.sortOrder);
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
  return apiFetch<OrdemServicoDTO>('/os', {
    method: 'POST',
    body: input,
    offlineDescription: `Criar OS para o cliente ${input.clienteCodigo}`,
  });
}

export interface AtualizarOSInput {
  diagnostico?: string;
  observacoes?: string;
  solucao?: string;
  prioridade?: OSPrioridade;
  responsavelId?: string;
  tecnicoId?: string;
  dataPrevista?: string;
  kmAtual?: number;
  kmFinal?: number;
}

export function atualizarOS(id: string, input: AtualizarOSInput): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>(`/os/${id}`, { method: 'PUT', body: input, offlineDescription: `Atualizar OS ${id}` });
}

export function alterarStatusOS(id: string, status: OSStatus): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>(`/os/${id}/status`, {
    method: 'PATCH',
    body: { status },
    offlineDescription: `Alterar status da OS ${id} para ${status}`,
  });
}

export function adicionarProdutoOS(id: string, produtoCodigo: string, quantidade: number): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>(`/os/${id}/produtos`, {
    method: 'POST',
    body: { produtoCodigo, quantidade },
    offlineDescription: `Adicionar produto ${produtoCodigo} na OS ${id}`,
  });
}

export function removerProdutoOS(id: string, produtoCodigo: string): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>(`/os/${id}/produtos/${produtoCodigo}`, {
    method: 'DELETE',
    offlineDescription: `Remover produto ${produtoCodigo} da OS ${id}`,
  });
}

export function adicionarServicoOS(id: string, servicoCodigo: string, quantidade: number): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>(`/os/${id}/servicos`, {
    method: 'POST',
    body: { servicoCodigo, quantidade },
    offlineDescription: `Adicionar serviço ${servicoCodigo} na OS ${id}`,
  });
}

export function removerServicoOS(id: string, servicoCodigo: string): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>(`/os/${id}/servicos/${servicoCodigo}`, {
    method: 'DELETE',
    offlineDescription: `Remover serviço ${servicoCodigo} da OS ${id}`,
  });
}
