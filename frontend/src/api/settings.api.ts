import { apiFetch } from './httpClient.js';

export interface FirebirdSettings {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  charset: string;
}

export type SmtpSeguranca = 'nenhuma' | 'starttls' | 'ssl';

export interface SmtpSettings {
  host: string;
  port: number;
  seguranca: SmtpSeguranca;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

export interface GeralSettings {
  nomeEmpresa: string;
  logoUrl: string;
  corDestaque: string;
  fusoHorario: string;
}

interface TestResult {
  ok: boolean;
  message: string;
}

export const getFirebirdSettings = () => apiFetch<FirebirdSettings>('/settings/firebird');
export const saveFirebirdSettings = (data: FirebirdSettings) =>
  apiFetch<FirebirdSettings>('/settings/firebird', { method: 'PUT', body: data });
export const testFirebirdSettings = (data: FirebirdSettings) =>
  apiFetch<TestResult>('/settings/firebird/test', { method: 'POST', body: data });

export const getSmtpSettings = () => apiFetch<SmtpSettings>('/settings/smtp');
export const saveSmtpSettings = (data: SmtpSettings) => apiFetch<SmtpSettings>('/settings/smtp', { method: 'PUT', body: data });
export const testSmtpSettings = (smtp: SmtpSettings, destino: string) =>
  apiFetch<TestResult>('/settings/smtp/test', { method: 'POST', body: { smtp, destino } });

export const getGeralSettings = () => apiFetch<GeralSettings>('/settings/geral');
export const saveGeralSettings = (data: GeralSettings) => apiFetch<GeralSettings>('/settings/geral', { method: 'PUT', body: data });

export interface Branding {
  nomeEmpresa: string;
  logoUrl: string;
  corDestaque: string;
}

/** Nome/logo do cliente pra sidebar — qualquer usuário autenticado pode ler (rota sem SYSTEM_SETTINGS). */
export const getBranding = () => apiFetch<Branding>('/settings/branding');
