import { apiFetch } from './httpClient.js';
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
