import { logger } from '../utils/logger.js';
import { getIntegracoesSettings } from './settings.service.js';

export interface InscricaoEstadualLookupResult {
  numero: string;
  ativo: boolean;
  uf: string;
  atualizadoEm?: string;
}

interface SintegraCnpjResponse {
  inscricoes_estaduais?: Array<{ inscricao_estadual: string; ativo: boolean; uf: string; atualizado_em?: string }>;
}

/**
 * Proxy pro SINTEGRA Brasil (item 3 da rodada de melhorias) — a BrasilAPI usada em cnpj.service.ts
 * não retorna Inscrição Estadual, essa é a 2ª API, desacoplada e opcional (sem chave configurada,
 * simplesmente não preenche IE automaticamente — nunca trava o cadastro manual do cliente).
 */
export async function consultarInscricaoEstadual(cnpjDigits: string): Promise<InscricaoEstadualLookupResult[]> {
  const { sintegraApiKey } = await getIntegracoesSettings();
  if (!sintegraApiKey) return [];

  let response: Response;
  try {
    response = await fetch(`https://www.sintegrabrasil.com.br/api/v1/cnpj/${cnpjDigits}`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'X-Api-Key': sintegraApiKey, Accept: 'application/json' },
    });
  } catch (err) {
    logger.warn({ err }, 'Falha de rede consultando IE no SINTEGRA Brasil');
    return [];
  }

  if (!response.ok) {
    logger.warn({ status: response.status }, 'SINTEGRA Brasil respondeu com erro consultando IE');
    return [];
  }

  const data = (await response.json()) as SintegraCnpjResponse;
  return (data.inscricoes_estaduais ?? []).map((item) => ({
    numero: item.inscricao_estadual,
    ativo: item.ativo,
    uf: item.uf,
    atualizadoEm: item.atualizado_em,
  }));
}
