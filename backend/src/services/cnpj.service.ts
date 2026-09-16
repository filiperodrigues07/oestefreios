import { ValidationError } from '../errors/ValidationError.js';
import type { RegimeTributario } from '../types/cherp.types.js';
import { logger } from '../utils/logger.js';

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
  /** Aproximação a partir de opcao_pelo_simples/opcao_pelo_mei da BrasilAPI — nunca a fonte oficial
   *  (essa é o CRT gravado no CHERP, ver ClienteRepository.firebird.ts), só um pré-preenchimento
   *  editável. undefined quando a BrasilAPI não informa nada confiável (não inventa Regime Normal). */
  regimeTributario?: RegimeTributario;
}

interface BrasilApiCnpjResponse {
  razao_social: string;
  nome_fantasia?: string;
  descricao_situacao_cadastral?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  ddd_telefone_1?: string;
  email?: string;
  opcao_pelo_simples?: boolean | null;
  opcao_pelo_mei?: boolean | null;
}

/** CRT (Código de Regime Tributário) padrão SEFAZ/NFe: 1=Simples Nacional, 3=Regime Normal. */
function derivarRegimeTributario(data: BrasilApiCnpjResponse): RegimeTributario | undefined {
  if (data.opcao_pelo_simples === true || data.opcao_pelo_mei === true) return 1;
  if (data.opcao_pelo_simples === false) return 3;
  return undefined;
}

/**
 * Proxy pro CNPJ da BrasilAPI (item 1 da rodada de melhorias) — nunca expor a API pública
 * direto pro frontend, sempre por aqui, pra não vazar rate-limit/instabilidade externa
 * como se fosse erro nosso, e pra manter só um lugar sabendo qual provedor usamos.
 */
export async function lookupCnpj(cnpjDigits: string): Promise<CnpjLookupResult> {
  let response: Response;
  try {
    response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`, {
      signal: AbortSignal.timeout(8000),
      // Sem um User-Agent de navegador, o Cloudflare na frente da BrasilAPI devolve 403 pro fetch
      // padrão do Node — descoberto testando de verdade contra a API real, não documentado por eles.
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    });
  } catch (err) {
    logger.warn({ err }, 'Falha de rede consultando CNPJ na BrasilAPI');
    throw new ValidationError('Não foi possível consultar o CNPJ — preencha manualmente.');
  }

  if (response.status === 404) {
    throw new ValidationError('CNPJ não encontrado.');
  }
  if (!response.ok) {
    logger.warn({ status: response.status }, 'BrasilAPI respondeu com erro consultando CNPJ');
    throw new ValidationError('Não foi possível consultar o CNPJ — preencha manualmente.');
  }

  const data = (await response.json()) as BrasilApiCnpjResponse;

  return {
    razaoSocial: data.razao_social,
    nomeFantasia: data.nome_fantasia || undefined,
    situacaoCadastral: data.descricao_situacao_cadastral,
    endereco: data.logradouro || undefined,
    numero: data.numero || undefined,
    bairro: data.bairro || undefined,
    cidade: data.municipio || undefined,
    uf: data.uf || undefined,
    cep: data.cep || undefined,
    telefone: data.ddd_telefone_1 || undefined,
    email: data.email || undefined,
    regimeTributario: derivarRegimeTributario(data),
  };
}
