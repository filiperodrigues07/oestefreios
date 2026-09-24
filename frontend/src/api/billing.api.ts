import { apiFetch, apiFetchBlob, apiFetchMultipart } from './httpClient.js';
import type { CobrancaConfigDTO, CobrancaDTO } from '../types/billing.types.js';
import type { BillingDTO, BillingStatusDTO, BillingUpdateInput, ControleAssinaturaInput, NovoPagamentoInput } from '../types/billing.types.js';

export function getBilling(): Promise<BillingDTO> {
  return apiFetch('/billing');
}

export function getBillingStatus(): Promise<BillingStatusDTO> {
  return apiFetch('/billing/status');
}

export function updateBilling(input: BillingUpdateInput): Promise<BillingDTO> {
  return apiFetch('/billing', { method: 'PUT', body: input, queueOffline: false });
}

export function addPagamento(input: NovoPagamentoInput): Promise<BillingDTO> {
  return apiFetch('/billing/pagamentos', { method: 'POST', body: input, queueOffline: false });
}

export function removePagamento(id: string): Promise<BillingDTO> {
  return apiFetch(`/billing/pagamentos/${id}`, { method: 'DELETE', queueOffline: false });
}

export function controlarAssinatura(input: ControleAssinaturaInput): Promise<BillingDTO> {
  return apiFetch('/billing/controle', { method: 'POST', body: input, queueOffline: false });
}

export function criarCobranca(dados: { referencia: string; vencimento: string; valor: number; observacao: string; arquivo: File }): Promise<CobrancaDTO> {
  const form = new FormData();
  form.append('referencia', dados.referencia);
  form.append('vencimento', dados.vencimento);
  form.append('valor', String(dados.valor));
  form.append('observacao', dados.observacao);
  form.append('arquivo', dados.arquivo);
  return apiFetchMultipart('/billing/cobrancas', form);
}

export function baixarCobranca(id: string): Promise<Blob> {
  return apiFetchBlob(`/billing/cobrancas/${id}/arquivo`);
}

export function enviarCobranca(id: string, body: { mensagem?: string }): Promise<CobrancaDTO> {
  return apiFetch(`/billing/cobrancas/${id}/enviar`, { method: 'POST', body, queueOffline: false });
}

export function removerCobranca(id: string): Promise<null> {
  return apiFetch(`/billing/cobrancas/${id}`, { method: 'DELETE', queueOffline: false });
}

export function getCobrancaConfig(): Promise<CobrancaConfigDTO> {
  return apiFetch('/billing/cobranca-config');
}

export function saveCobrancaConfig(input: CobrancaConfigDTO): Promise<CobrancaConfigDTO> {
  return apiFetch('/billing/cobranca-config', { method: 'PUT', body: input, queueOffline: false });
}

export function getCobrancaSmtpPassword(): Promise<{ password: string }> {
  return apiFetch('/billing/cobranca-config/senha');
}

export function testarCobrancaSmtp(destino: string): Promise<{ ok: boolean; message: string }> {
  return apiFetch('/billing/cobranca-config/testar', { method: 'POST', body: { destino }, queueOffline: false });
}
