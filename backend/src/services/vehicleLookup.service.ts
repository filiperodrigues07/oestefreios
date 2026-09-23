import type { PoolClient } from 'pg';
import { env } from '../config/env.js';
import { pool } from '../database/postgres/client.js';
import { AppError } from '../errors/AppError.js';
import { equipamentoRepository } from '../repositories/index.js';
import { DadosApiVehicleProvider } from '../providers/DadosApiVehicleProvider.js';
import type { VehicleLookupResult, VehiclePlateProvider } from '../providers/VehiclePlateProvider.js';

const TENANT_ID = 'default'; // A aplicação atual é single-tenant; centralizado para futura resolução pelo contexto autenticado.
const PROVIDER = new DadosApiVehicleProvider();

export interface VehicleLookupQuota {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  period: string;
  exhausted: boolean;
}

export type VehicleLookupResponse =
  | { source: 'provider' | 'cache'; vehicle: VehicleLookupResult; quota: VehicleLookupQuota }
  | { source: 'existing'; existingVehicle: Awaited<ReturnType<typeof equipamentoRepository.buscarPorPlaca>>; quota: VehicleLookupQuota };

export function normalizePlate(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidPlate(plate: string): boolean {
  return /^[A-Z]{3}(?:[0-9]{4}|[0-9][A-Z][0-9]{2})$/.test(plate);
}

export function quotaFromUsed(used: number, limit = env.VEHICLE_LOOKUP_MONTHLY_LIMIT, now = new Date()): VehicleLookupQuota {
  const remaining = Math.max(limit - used, 0);
  return {
    used,
    limit,
    remaining,
    percentage: limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100)),
    period: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(now),
    exhausted: used >= limit,
  };
}

async function usedThisMonth(client: Pick<PoolClient, 'query'> = pool): Promise<number> {
  const result = await client.query<{ count: string }>(`
    SELECT COUNT(*)::text AS count
      FROM vehicle_lookup_requests
     WHERE tenant_id = $1 AND consumed_quota = true
       AND created_at >= (date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')
       AND created_at < ((date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') + interval '1 month') AT TIME ZONE 'America/Sao_Paulo')
  `, [TENANT_ID]);
  return Number(result.rows[0]?.count ?? 0);
}

export async function getVehicleLookupQuota(): Promise<VehicleLookupQuota> {
  return quotaFromUsed(await usedThisMonth());
}

async function findCached(client: Pick<PoolClient, 'query'>, plate: string): Promise<VehicleLookupResult | null> {
  const result = await client.query<{ result: VehicleLookupResult }>(`
    SELECT result FROM vehicle_lookup_requests
     WHERE tenant_id = $1 AND plate = $2 AND success = true
       AND result IS NOT NULL AND cache_expires_at > now()
     ORDER BY created_at DESC LIMIT 1
  `, [TENANT_ID, plate]);
  return result.rows[0]?.result ?? null;
}

export async function lookupVehiclePlate(rawPlate: string, provider: VehiclePlateProvider = PROVIDER): Promise<VehicleLookupResponse> {
  const plate = normalizePlate(rawPlate);
  if (!isValidPlate(plate)) throw new AppError('INVALID_PLATE', 'Informe uma placa válida.', 400);

  const existingVehicle = await equipamentoRepository.buscarPorPlaca(plate);
  if (existingVehicle) return { source: 'existing', existingVehicle, quota: await getVehicleLookupQuota() };

  const cached = await findCached(pool, plate);
  if (cached) return { source: 'cache', vehicle: cached, quota: await getVehicleLookupQuota() };

  const client = await pool.connect();
  let deferredError: unknown;
  let response: VehicleLookupResponse | undefined;
  try {
    await client.query('BEGIN');
    // O lock mensal impede duas placas diferentes de passarem juntas pelo último crédito.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`vehicle-lookup-quota:${TENANT_ID}`]);
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`vehicle-lookup:${TENANT_ID}:${plate}`]);

    const cachedAfterLock = await findCached(client, plate);
    if (cachedAfterLock) {
      response = { source: 'cache', vehicle: cachedAfterLock, quota: quotaFromUsed(await usedThisMonth(client)) };
    } else {
      const used = await usedThisMonth(client);
      if (used >= env.VEHICLE_LOOKUP_MONTHLY_LIMIT) {
        throw new AppError('VEHICLE_LOOKUP_LIMIT_REACHED', 'O limite mensal de consultas automáticas foi atingido. Você ainda pode cadastrar o veículo manualmente.', 429, true, quotaFromUsed(used));
      }

      try {
        const result = await provider.lookup(plate);
        if (result.kind === 'not_found') {
          await client.query(`INSERT INTO vehicle_lookup_requests (tenant_id, provider, plate, status, success, consumed_quota) VALUES ($1,$2,$3,'not_found',false,false)`, [TENANT_ID, provider.name, plate]);
          deferredError = new AppError('VEHICLE_NOT_FOUND', 'Não encontramos informações para esta placa. Você pode continuar o cadastro manualmente.', 404, true, quotaFromUsed(used));
        } else {
          await client.query(`INSERT INTO vehicle_lookup_requests (tenant_id, provider, plate, status, success, consumed_quota, result, cache_expires_at) VALUES ($1,$2,$3,'success',true,true,$4,now() + ($5 * interval '1 day'))`, [TENANT_ID, provider.name, plate, JSON.stringify(result.vehicle), env.VEHICLE_LOOKUP_CACHE_TTL_DAYS]);
          response = { source: 'provider', vehicle: result.vehicle, quota: quotaFromUsed(used + 1) };
        }
      } catch (error) {
        if (!deferredError) {
          const status = error instanceof AppError ? error.code.toLowerCase() : 'error';
          await client.query(`INSERT INTO vehicle_lookup_requests (tenant_id, provider, plate, status, success, consumed_quota) VALUES ($1,$2,$3,$4,false,false)`, [TENANT_ID, provider.name, plate, status]);
          deferredError = error;
        }
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  if (deferredError) throw deferredError;
  return response!;
}
