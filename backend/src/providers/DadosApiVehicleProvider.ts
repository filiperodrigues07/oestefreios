import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { getIntegracoesSettings } from '../services/settings.service.js';
import type { ProviderLookupResult, VehicleLookupResult, VehiclePlateProvider } from './VehiclePlateProvider.js';

type JsonObject = Record<string, unknown>;

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function year(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1900 && parsed <= 2200 ? parsed : undefined;
}

function object(value: unknown): JsonObject | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonObject : undefined;
}

export function mapDadosApiResponse(payload: unknown, requestedPlate: string): VehicleLookupResult | null {
  const data = object(payload);
  if (!data) return null;
  const message = text(data.mensagemRetorno)?.toLowerCase();
  if (message && !message.includes('sem erro') && (message.includes('não encontr') || message.includes('nao encontr'))) return null;
  const extra = object(data.extra);
  const fipe = object(data.fipe);
  const fipeRows = Array.isArray(fipe?.dados) ? fipe.dados.map(object).filter(Boolean) as JsonObject[] : [];
  const firstFipe = fipeRows[0];
  const plate = text(data.placa)?.replace(/[^A-Za-z0-9]/g, '').toUpperCase() ?? requestedPlate;
  const brand = text(data.marca) ?? text(data.MARCA);
  const model = text(data.modelo) ?? text(data.MODELO);
  if (!brand && !model) return null;
  return {
    plate,
    brand,
    model,
    version: text(data.VERSAO) ?? text(data.versao),
    manufactureYear: year(data.ano) ?? year(extra?.ano_fabricacao),
    modelYear: year(data.anoModelo) ?? year(extra?.ano_modelo),
    color: text(data.cor),
    fuel: text(data.combustivel) ?? text(firstFipe?.combustivel),
    city: text(data.municipio),
    state: text(data.uf),
    engine: text(data.cilindradas) ?? text(extra?.cilindradas) ?? text(data.motor),
    fipeCode: text(firstFipe?.codigo_fipe),
  };
}

export class DadosApiVehicleProvider implements VehiclePlateProvider {
  readonly name = 'dadosapi';

  constructor(private readonly tokenOverride?: string) {}

  async lookup(plate: string): Promise<ProviderLookupResult> {
    const token = this.tokenOverride ?? (await getIntegracoesSettings()).dadosApiToken;
    if (!token) throw new AppError('VEHICLE_LOOKUP_NOT_CONFIGURED', 'A consulta automática ainda não foi configurada.', 503);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${env.DADOS_API_BASE_URL.replace(/\/$/, '')}/dados-publicos/consulta-veiculo-por-placa`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ placa: plate }),
        signal: controller.signal,
      });
      if (response.status === 404) return { kind: 'not_found' };
      if (response.status === 429) throw new AppError('VEHICLE_PROVIDER_RATE_LIMIT', 'O serviço de consulta está temporariamente indisponível. Tente novamente mais tarde.', 503);
      if (!response.ok) throw new AppError('VEHICLE_PROVIDER_UNAVAILABLE', 'Não foi possível consultar a placa neste momento. Tente novamente ou continue o cadastro manualmente.', 502);
      const vehicle = mapDadosApiResponse(await response.json(), plate);
      return vehicle ? { kind: 'found', vehicle } : { kind: 'not_found' };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Error && error.name === 'AbortError') throw new AppError('VEHICLE_PROVIDER_TIMEOUT', 'A consulta demorou mais que o esperado. Tente novamente.', 504);
      throw new AppError('VEHICLE_PROVIDER_UNAVAILABLE', 'Não foi possível consultar a placa neste momento. Tente novamente ou continue o cadastro manualmente.', 502);
    } finally {
      clearTimeout(timer);
    }
  }
}
