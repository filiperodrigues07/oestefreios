import { ValidationError } from '../errors/ValidationError.js';
import { logger } from '../utils/logger.js';

export interface CepLookupResult {
  cep: string;
  endereco?: string;
  bairro?: string;
  cidade: string;
  uf: string;
}

interface BrasilApiCepResponse {
  cep?: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

/** Consulta de CEP pelo backend para manter o provedor externo fora do navegador. */
export async function lookupCep(cepDigits: string): Promise<CepLookupResult> {
  let response: Response;
  try {
    response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cepDigits}`, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    });
  } catch (error) {
    logger.warn({ error }, 'Falha de rede consultando CEP na BrasilAPI');
    throw new ValidationError('Não foi possível consultar o CEP — preencha o endereço manualmente.');
  }

  if (response.status === 404) throw new ValidationError('CEP não encontrado.');
  if (!response.ok) {
    logger.warn({ status: response.status }, 'BrasilAPI respondeu com erro consultando CEP');
    throw new ValidationError('Não foi possível consultar o CEP — preencha o endereço manualmente.');
  }

  const data = (await response.json()) as BrasilApiCepResponse;
  if (!data.city || !data.state) throw new ValidationError('CEP retornou um endereço incompleto.');

  const digitos = (data.cep ?? cepDigits).replace(/\D/g, '');
  return {
    cep: digitos.length === 8 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : cepDigits,
    endereco: data.street || undefined,
    bairro: data.neighborhood || undefined,
    cidade: data.city,
    uf: data.state,
  };
}
