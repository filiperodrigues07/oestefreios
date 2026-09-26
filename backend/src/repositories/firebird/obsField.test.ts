import { describe, expect, it } from 'vitest';
import { decodeObsTexto, encodeObsTexto } from './obsField.js';

describe('campo OBS da OS', () => {
  it('lê o formato que volta do CHERP (\r\n, sem linha final)', () => {
    expect(decodeObsTexto('[OBSERVACOES]\r\nTESTE DUPLICADO\r\n[SOLUCAO]')).toEqual({ observacoes: 'TESTE DUPLICADO', solucao: undefined });
    expect(decodeObsTexto('[OBSERVACOES]\r\nFAZER FUNCIONAR\r\n[SOLUCAO]\r\nNADA')).toEqual({ observacoes: 'FAZER FUNCIONAR', solucao: 'NADA' });
    expect(decodeObsTexto('[OBSERVACOES]\nteste\n[SOLUCAO]\n')).toEqual({ observacoes: 'teste', solucao: undefined });
  });

  it('texto digitado direto no CHERP (sem marcador) vira observação', () => {
    expect(decodeObsTexto('CLIENTE BUSCA SEXTA\r\nLIGAR ANTES')).toEqual({ observacoes: 'CLIENTE BUSCA SEXTA\nLIGAR ANTES', solucao: undefined });
    expect(decodeObsTexto(null)).toEqual({ observacoes: undefined, solucao: undefined });
  });

  it('limpa marcadores acumulados por regravação', () => {
    const sujo = '[OBSERVACOES]\n[OBSERVACOES]\r\nTESTE\r\n[SOLUCAO]\n[SOLUCAO]\nTROCA DE PASTILHA';
    expect(decodeObsTexto(sujo)).toEqual({ observacoes: 'TESTE', solucao: 'TROCA DE PASTILHA' });
  });

  it('sem solução grava texto puro; com solução, marcadores; ida e volta preserva', () => {
    expect(encodeObsTexto('TESTE', '')).toBe('TESTE');
    expect(encodeObsTexto('', '')).toBeNull();
    const gravado = encodeObsTexto('OBS', 'SOLUCAO FEITA')!;
    expect(decodeObsTexto(gravado.replace(/\n/g, '\r\n'))).toEqual({ observacoes: 'OBS', solucao: 'SOLUCAO FEITA' });
    expect(decodeObsTexto(encodeObsTexto('', 'SO SOLUCAO'))).toEqual({ observacoes: undefined, solucao: 'SO SOLUCAO' });
  });
});
