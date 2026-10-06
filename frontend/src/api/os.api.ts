import { apiFetch, apiFetchBlob, salvarBlobComoArquivo } from './httpClient.js';
import type { OrdemServicoDTO, OSPrioridade, OSStatus } from '../types/os.types.js';

interface PaginatedOS {
  items: OrdemServicoDTO[];
  total: number;
}

export type OSSortBy =
  | 'numero'
  | 'clienteNome'
  | 'equipamentoDescricao'
  | 'dataAbertura'
  | 'status'
  | 'situacaoDocumento'
  | 'prioridade'
  | 'faturamento';

export interface ListarOSFiltro {
  status?: OSStatus | 'AGUARDANDO';
  situacaoDocumento?: number;
  incluirFinalizadas?: boolean;
  /** Só OS finalizadas pelo app que seguem em aberto no CHERP (exige OS_VIEW_FINALIZADAS no backend). */
  somenteFinalizadasApp?: boolean;
  /** Situação de atendimento do CHERP (código 000001…000006). */
  situacaoAtendimento?: string;
  clienteCodigo?: string;
  prioridade?: OSPrioridade;
  busca?: string;
  dataInicial?: string;
  dataFinal?: string;
  sortBy?: OSSortBy;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export function listarOS(filtro: ListarOSFiltro = {}): Promise<PaginatedOS> {
  const params = new URLSearchParams();
  if (filtro.status) params.set('status', filtro.status);
  if (filtro.situacaoDocumento !== undefined)
    params.set('situacaoDocumento', String(filtro.situacaoDocumento));
  if (filtro.incluirFinalizadas) params.set('incluirFinalizadas', 'true');
  if (filtro.somenteFinalizadasApp) params.set('somenteFinalizadasApp', 'true');
  if (filtro.situacaoAtendimento) params.set('situacaoAtendimento', filtro.situacaoAtendimento);
  if (filtro.clienteCodigo) params.set('clienteCodigo', filtro.clienteCodigo);
  if (filtro.prioridade) params.set('prioridade', filtro.prioridade);
  if (filtro.busca) params.set('busca', filtro.busca);
  if (filtro.dataInicial) params.set('dataInicial', filtro.dataInicial);
  if (filtro.dataFinal) params.set('dataFinal', filtro.dataFinal);
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
  kmAtual: number;
  kmFinal: number;
  garantia?: string;
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

/** Duplicar/excluir nunca entram na fila offline: gerar número/DAV ou sumir com uma OS exige rede de verdade. */
export function duplicarOS(id: string, km: { kmAtual: number; kmFinal: number }): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>(`/os/${id}/duplicar`, { method: 'POST', body: km, queueOffline: false });
}

export function excluirOS(id: string, motivo: string): Promise<null> {
  return apiFetch<null>(`/os/${id}`, { method: 'DELETE', body: { motivo }, queueOffline: false });
}

/** Desfaz "Finalizar OS"/cancelamento feito pelo app (permissão OS_REOPEN). Nunca vai pra fila offline. */
export function reabrirOS(id: string, motivo: string): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>(`/os/${id}/reabrir`, {
    method: 'POST',
    body: { motivo },
    queueOffline: false,
  });
}

export interface AtualizarOSInput {
  diagnostico?: string;
  observacoes?: string;
  prioridade?: OSPrioridade;
  responsavelId?: string;
  tecnicoId?: string;
  dataPrevista?: string;
  kmAtual?: number;
  kmFinal?: number;
  /** "Diagnóstico de abertura" (PROBLEMAABERTURAOS no CHERP). */
  problema?: string;
  /** AAAA-MM-DD; `null` limpa a garantia. */
  garantia?: string | null;
  /** Valores vistos ao começar a editar — o backend responde 409 OS_CONFLICT se mudaram (ver os.service.ts). */
  base?: {
    problema?: string;
    diagnostico?: string;
    observacoes?: string;
    kmAtual?: number | null;
    kmFinal?: number | null;
  };
}

export function atualizarOS(id: string, input: AtualizarOSInput): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>(`/os/${id}`, {
    method: 'PUT',
    body: input,
    offlineDescription: `Atualizar OS ${id}`,
  });
}

export function trocarVinculoOS(
  id: string,
  vinculo: { clienteCodigo: string; equipamentoCodigo: string },
): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>(`/os/${id}/vinculo`, {
    method: 'PATCH',
    body: vinculo,
    offlineDescription: `Trocar cliente/veículo da OS ${id}`,
  });
}

export function alterarStatusOS(id: string, status: OSStatus): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>(`/os/${id}/status`, {
    method: 'PATCH',
    body: { status },
    offlineDescription: `Alterar status da OS ${id} para ${status}`,
  });
}

export type OsMessageType =
  'aberta' | 'aguardando_cliente' | 'aguardando_peca' | 'pronta' | 'resumo_financeiro';
export type OsMessageChannel = 'whatsapp' | 'email';
export interface OsMessagePreview {
  clientName: string;
  whatsapp: string | null;
  whatsappIssue: 'missing' | 'invalid' | null;
  email: string | null;
  whatsappConsent: boolean;
  messages: Partial<Record<OsMessageType, string>>;
}
export interface OsMessageHistoryItem {
  id: string;
  channel: OsMessageChannel;
  messageType: OsMessageType;
  recipient: string;
  body: string | null;
  state: string;
  errorCode: string | null;
  source: 'manual' | 'automatic';
  createdAt: string;
}
export const getOsMessagePreview = (id: string) => apiFetch<OsMessagePreview>(`/os/${id}/mensagem`);
export const getOsMessageHistory = (id: string) =>
  apiFetch<OsMessageHistoryItem[]>(`/os/${id}/mensagem/historico`);
export const sendOsMessage = (
  id: string,
  channel: OsMessageChannel,
  type: OsMessageType,
  consent: boolean,
  attachPdf = false,
) =>
  apiFetch<{ id: string; state: string }>(`/os/${id}/mensagem`, {
    method: 'POST',
    body: { channel, type, consent, attachPdf },
    queueOffline: false,
  });
export const revokeOsWhatsappConsent = (id: string) =>
  apiFetch<null>(`/os/${id}/mensagem/revogar-whatsapp`, { method: 'POST', queueOffline: false });

export function adicionarProdutoOS(
  id: string,
  produtoCodigo: string,
  quantidade: number,
  precoUnitario?: number,
  descricaoComplementar?: string,
): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>(`/os/${id}/produtos`, {
    method: 'POST',
    body: {
      produtoCodigo,
      quantidade,
      ...(precoUnitario !== undefined ? { precoUnitario } : {}),
      ...(descricaoComplementar ? { descricaoComplementar } : {}),
    },
    offlineDescription: `Adicionar produto ${produtoCodigo} na OS ${id}`,
  });
}

const itemQuery = (itemId?: number) => (itemId === undefined ? '' : `?itemId=${itemId}`);

export function removerProdutoOS(
  id: string,
  produtoCodigo: string,
  itemId?: number,
): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>(`/os/${id}/produtos/${produtoCodigo}${itemQuery(itemId)}`, {
    method: 'DELETE',
    offlineDescription: `Remover produto ${produtoCodigo} da OS ${id}`,
  });
}

export function atualizarProdutoItemOS(
  id: string,
  produtoCodigo: string,
  patch: { quantidade?: number; precoUnitario?: number; descricaoComplementar?: string },
  itemId?: number,
): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>(`/os/${id}/produtos/${produtoCodigo}${itemQuery(itemId)}`, {
    method: 'PATCH',
    body: patch,
    offlineDescription: `Atualizar produto ${produtoCodigo} na OS ${id}`,
  });
}

export function adicionarServicoOS(
  id: string,
  servicoCodigo: string,
  quantidade: number,
  valorUnitario?: number,
  descricaoComplementar?: string,
): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>(`/os/${id}/servicos`, {
    method: 'POST',
    body: {
      servicoCodigo,
      quantidade,
      ...(valorUnitario !== undefined ? { valorUnitario } : {}),
      ...(descricaoComplementar ? { descricaoComplementar } : {}),
    },
    offlineDescription: `Adicionar serviço ${servicoCodigo} na OS ${id}`,
  });
}

/** "Desfazer" depois de remover: o backend reinsere a linha escolhida (preço vem do servidor). */
export function restaurarItemOS(
  id: string,
  tipo: 'produto' | 'servico',
  codigo: string,
  itemId?: number,
): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>(
    `/os/${id}/${tipo === 'produto' ? 'produtos' : 'servicos'}/${codigo}/restaurar${itemQuery(itemId)}`,
    {
      method: 'POST',
      // Desfazer só faz sentido na hora; replay offline minutos depois surpreenderia o usuário.
      queueOffline: false,
    },
  );
}

export function removerServicoOS(
  id: string,
  servicoCodigo: string,
  itemId?: number,
): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>(`/os/${id}/servicos/${servicoCodigo}${itemQuery(itemId)}`, {
    method: 'DELETE',
    offlineDescription: `Remover serviço ${servicoCodigo} da OS ${id}`,
  });
}

export function atualizarServicoItemOS(
  id: string,
  servicoCodigo: string,
  patch: { quantidade?: number; precoUnitario?: number; descricaoComplementar?: string },
  itemId?: number,
): Promise<OrdemServicoDTO> {
  return apiFetch<OrdemServicoDTO>(`/os/${id}/servicos/${servicoCodigo}${itemQuery(itemId)}`, {
    method: 'PATCH',
    body: patch,
    offlineDescription: `Atualizar serviço ${servicoCodigo} na OS ${id}`,
  });
}

/** O mesmo Blob alimenta a prévia e o download, sem gerar o PDF duas vezes. */
export function carregarOSPdf(id: string, signal?: AbortSignal): Promise<Blob> {
  return apiFetchBlob(`/os/${id}/pdf`, false, signal);
}

export function salvarOSPdf(blob: Blob, numero: number): void {
  salvarBlobComoArquivo(blob, `os-${numero}.pdf`);
}

export async function baixarOSPdf(id: string, numero: number): Promise<void> {
  salvarOSPdf(await carregarOSPdf(id), numero);
}
