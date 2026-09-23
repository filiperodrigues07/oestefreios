import { afterEach, describe, expect, it, vi } from 'vitest';
import { DadosApiVehicleProvider, mapDadosApiResponse } from '../../providers/DadosApiVehicleProvider.js';
import { isValidPlate, normalizePlate, quotaFromUsed } from '../vehicleLookup.service.js';

describe('vehicle lookup', () => {
  afterEach(() => vi.unstubAllGlobals());
  it.each([
    ['ABC-1234', 'ABC1234'],
    ['abc1d23', 'ABC1D23'],
  ])('normaliza %s', (input, expected) => expect(normalizePlate(input)).toBe(expected));

  it.each(['ABC1234', 'ABC1D23'])('aceita placa brasileira %s', (plate) => expect(isValidPlate(plate)).toBe(true));
  it.each(['ABC123', '1234ABC', 'ABC11D3', ''])('rejeita placa inválida %s', (plate) => expect(isValidPlate(plate)).toBe(false));

  it('calcula quota e virada do período sem contador resetável', () => {
    expect(quotaFromUsed(18, 50, new Date('2026-09-22T12:00:00Z'))).toEqual({
      used: 18, limit: 50, remaining: 32, percentage: 36, period: '2026-09', exhausted: false,
    });
    expect(quotaFromUsed(50, 50).exhausted).toBe(true);
  });

  it('mapeia a resposta atual da DadosAPI e tolera campos ausentes', () => {
    expect(mapDadosApiResponse({
      marca: 'VW', modelo: 'NIVUS', VERSAO: 'COMFORTLINE', ano: '2022', anoModelo: '2023',
      cor: 'PRATA', municipio: 'Joinville', uf: 'SC',
      fipe: { dados: [{ codigo_fipe: '005340-6', combustivel: 'Gasolina' }] },
    }, 'ABC1D23')).toEqual({
      plate: 'ABC1D23', brand: 'VW', model: 'NIVUS', version: 'COMFORTLINE', manufactureYear: 2022,
      modelYear: 2023, color: 'PRATA', fuel: 'Gasolina', city: 'Joinville', state: 'SC',
      engine: undefined, fipeCode: '005340-6',
    });
  });

  it('não inventa veículo quando marca e modelo não existem', () => {
    expect(mapDadosApiResponse({ mensagemRetorno: 'Sem erros.' }, 'ABC1D23')).toBeNull();
  });

  it.each([
    [429, 'VEHICLE_PROVIDER_RATE_LIMIT'],
    [503, 'VEHICLE_PROVIDER_UNAVAILABLE'],
  ])('traduz HTTP %s sem expor resposta técnica', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })));
    await expect(new DadosApiVehicleProvider('test-token').lookup('ABC1D23')).rejects.toMatchObject({ code });
  });

  it('traduz timeout do provider', async () => {
    const timeout = new Error('aborted');
    timeout.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeout));
    await expect(new DadosApiVehicleProvider('test-token').lookup('ABC1D23')).rejects.toMatchObject({ code: 'VEHICLE_PROVIDER_TIMEOUT' });
  });
});
