import { apiFetch, apiFetchBlob, apiFetchMultipart } from './httpClient.js';
import type { CobrancaConfigDTO, CobrancaDTO, CobrancaInput } from '../types/billing.types.js';
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

/** O PDF é opcional: sem ele a cobrança fica "sem boleto" até anexar. */
export function criarCobranca(dados: CobrancaInput & { arquivo: File | null }): Promise<CobrancaDTO> {
  const form = new FormData();
  form.append('referencia', dados.referencia);
  form.append('vencimento', dados.vencimento);
  form.append('valor', String(dados.valor));
  form.append('observacao', dados.observacao);
  form.append('linhaDigitavel', dados.linhaDigitavel);
  form.append('pixCopiaCola', dados.pixCopiaCola);
  if (dados.arquivo) form.append('arquivo', dados.arquivo);
  return apiFetchMultipart('/billing/cobrancas', form);
}

export function atualizarCobranca(id: string, dados: CobrancaInput): Promise<CobrancaDTO> {
  return apiFetch(`/billing/cobrancas/${id}`, { method: 'PUT', body: dados, queueOffline: false });
}

export function gerarCobrancas(dados: { inicio: string; meses: number }): Promise<{ criadas: CobrancaDTO[]; puladas: string[] }> {
  return apiFetch('/billing/cobrancas/gerar', { method: 'POST', body: dados, queueOffline: false });
}

export function anexarBoleto(id: string, arquivo: File): Promise<CobrancaDTO> {
  const form = new FormData();
  form.append('arquivo', arquivo);
  return apiFetchMultipart(`/billing/cobrancas/${id}/arquivo`, form);
}

export function desfazerBaixa(id: string): Promise<BillingDTO & { vencimentoRestaurado: boolean }> {
  return apiFetch(`/billing/cobrancas/${id}/desfazer-baixa`, { method: 'POST', queueOffline: false });
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

export function testarCobrancaSmtp(destino: string): Promise<{ ok: boolean; message: string }> {
  return apiFetch('/billing/cobranca-config/testar', { method: 'POST', body: { destino }, queueOffline: false });
}
