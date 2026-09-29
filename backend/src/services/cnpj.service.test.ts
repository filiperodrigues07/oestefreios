import { afterEach, describe, expect, it, vi } from 'vitest';
import { derivarRegimeTributario, lookupCnpj } from './cnpj.service.js';

const base = { razao_social: 'EMPRESA TESTE LTDA' };

describe('regime tributário a partir da BrasilAPI', () => {
  it('optante pelo Simples ou MEI é 1', () => {
    expect(derivarRegimeTributario({ ...base, opcao_pelo_simples: true })).toBe(1);
    expect(derivarRegimeTributario({ ...base, opcao_pelo_simples: false, opcao_pelo_mei: true })).toBe(1);
  });

  it('não optante é 3', () => {
    expect(derivarRegimeTributario({ ...base, opcao_pelo_simples: false, opcao_pelo_mei: false })).toBe(3);
  });

  it('Simples nulo: usa exclusão do Simples, lucro presumido/real ou porte DEMAIS', () => {
    expect(derivarRegimeTributario({ ...base, opcao_pelo_simples: null, data_exclusao_do_simples: '2022-01-01' })).toBe(3);
    expect(derivarRegimeTributario({
      ...base, opcao_pelo_simples: null,
      regime_tributario: [{ ano: 2018, forma_de_tributacao: 'LUCRO REAL' }, { ano: 2023, forma_de_tributacao: 'LUCRO PRESUMIDO' }],
    })).toBe(3);
    expect(derivarRegimeTributario({ ...base, opcao_pelo_simples: null, porte: 'DEMAIS' })).toBe(3);
  });

  it('sem nenhum sinal não inventa regime', () => {
    expect(derivarRegimeTributario({ ...base, opcao_pelo_simples: null, opcao_pelo_mei: null, porte: 'MICRO EMPRESA', regime_tributario: [] })).toBeUndefined();
    expect(derivarRegimeTributario(base)).toBeUndefined();
  });

  describe('consulta', () => {
    afterEach(() => vi.unstubAllGlobals());
    it('devolve o regime junto dos dados cadastrais', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
        razao_social: 'PETROLEO BRASILEIRO S A PETROBRAS', opcao_pelo_simples: null, opcao_pelo_mei: null, porte: 'DEMAIS',
      }), { status: 200 })));
      expect((await lookupCnpj('33000167000101')).regimeTributario).toBe(3);
    });
  });
});
