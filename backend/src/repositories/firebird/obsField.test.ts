import { describe, expect, it } from 'vitest';
import { decodeObsTexto, encodeObsTexto, temMarcadorAntigo } from './obsField.js';

describe('campo OBS (Observação do CHERP)', () => {
  it('grava sempre texto livre, sem marcador', () => {
    expect(encodeObsTexto('  CLIENTE AGUARDA  ')).toBe('CLIENTE AGUARDA');
    expect(encodeObsTexto('')).toBeNull();
    expect(encodeObsTexto(undefined)).toBeNull();
  });

  it('lê o formato antigo que volta do CHERP (\\r\\n, sem linha final) só com o texto', () => {
    expect(decodeObsTexto('[OBSERVACOES]\r\nTESTE\r\n[SOLUCAO]')).toEqual({ observacoes: 'TESTE' });
    expect(decodeObsTexto('[OBSERVACOES]\nteste\n[SOLUCAO]\n')).toEqual({ observacoes: 'teste' });
  });

  it('antigo "serviço realizado" vai pro fim das observações (nada se perde)', () => {
    expect(decodeObsTexto('[OBSERVACOES]\r\nFAZER FUNCIONAR\r\n[SOLUCAO]\r\nNADA')).toEqual({ observacoes: 'FAZER FUNCIONAR\nNADA' });
    expect(decodeObsTexto('[OBSERVACOES]\n\n[SOLUCAO]\nSO SOLUCAO')).toEqual({ observacoes: 'SO SOLUCAO' });
  });

  it('limpa marcadores acumulados e texto digitado direto no CHERP passa intacto', () => {
    expect(decodeObsTexto('[OBSERVACOES]\n[OBSERVACOES]\r\nTESTE\r\n[SOLUCAO]\n[SOLUCAO]\nTROCA')).toEqual({ observacoes: 'TESTE\nTROCA' });
    expect(decodeObsTexto('CLIENTE BUSCA SEXTA\r\nLIGAR ANTES')).toEqual({ observacoes: 'CLIENTE BUSCA SEXTA\nLIGAR ANTES' });
    expect(decodeObsTexto(null)).toEqual({ observacoes: undefined });
  });

  it('identifica OBS no formato antigo', () => {
    expect(temMarcadorAntigo('[OBSERVACOES]\r\nX\r\n[SOLUCAO]')).toBe(true);
    expect(temMarcadorAntigo('TEXTO LIVRE')).toBe(false);
    expect(temMarcadorAntigo(null)).toBe(false);
  });
});
