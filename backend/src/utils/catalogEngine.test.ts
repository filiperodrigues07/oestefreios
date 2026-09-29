import { describe, expect, it } from 'vitest';
import { buscarNoIndice, construirIndice, distanciaEdicao, fonetica, ordenarHits, radical, tokenizar } from './catalogEngine.js';

const catalogo = construirIndice([
  { codigo: '000324', descricao: 'AROMATIZANTE C/ VARETA 30 ML' },
  { codigo: '000416', descricao: 'REPARO CATRACA FREIO' },
  { codigo: '001077', descricao: 'PASTILHA FREIO DT KIA' },
  { codigo: '001604', descricao: 'SYL 2341 - PASTILHA FREIO DIANTEIRA RENAULT MASTER' },
  { codigo: '001283', descricao: 'BUCHA MOLA DT - DAF NEW' },
  { codigo: '000997', descricao: 'BUCHA MOLA TZ - MB ATEGO' },
  { codigo: '000765', descricao: 'AMORTECEDOR TZ FORD CARGO' },
  { codigo: '000943', descricao: 'BALANÇA CAR. FACCHINI 51' },
  { codigo: '001899', descricao: 'BALANÇA CAR. LIBRELATO LUBFREE' },
  { codigo: '000083', descricao: 'BUCHA BALANÇA 50MM' },
  { codigo: '000046', descricao: 'COXIM TZ MOTOR VOLVO FH - COMPLETO' },
  { codigo: '001603', descricao: 'COXIM BORRACHA SUPORTE TRASEIR CABINE VOLKS CONSTELLATION' },
  { codigo: '000300', descricao: 'OLEO MOTOR 15W-40 LITRO' },
  { codigo: '000301', descricao: 'OLEO CAMBIO 80W90' },
  { codigo: '000199', descricao: 'SOQUETE IMPACTO CURTO SEXT. 3/4 SATA 30MM' },
  { codigo: '001572', descricao: 'ARAME MIG / SOLDA - REGULADOR' },
  { codigo: '000239', descricao: 'SERVIÇO TROCA DE LONA CARRETA 1º EX LD', tipo: '01' },
  { codigo: '000244', descricao: 'SERVIÇO TROCA DE LONA CARRETA 3º EX LE', tipo: '02' },
  { codigo: '000781', descricao: 'PARAFUSO' },
]);

const descricoes = (termo: string) => buscarNoIndice(catalogo, termo).map((h) => h.entry.descricao);

describe('normalização', () => {
  it('separa letras de números e ignora acento, hífen e ordinal', () => {
    expect(tokenizar('15W-40')).toEqual(['15', 'W', '40']);
    expect(tokenizar('15w40')).toEqual(['15', 'W', '40']);
    expect(tokenizar('Balança 3º Eixo')).toEqual(['BALANCA', '3', 'EIXO']);
  });
  it('radical tira plural e gênero', () => {
    expect(radical('PASTILHAS')).toBe(radical('PASTILHA'));
    expect(radical('DIANTEIRA')).toBe(radical('DIANTEIRO'));
    expect(radical('MOTORES')).toBe(radical('MOTOR'));
    expect(radical('ROLAMENTOS')).toBe(radical('ROLAMENTO'));
  });
  it('distância de edição conta troca de letras vizinhas como 1', () => {
    expect(distanciaEdicao('AMORTECEDRO', 'AMORTECEDOR', 2)).toBe(1);
    expect(distanciaEdicao('BUCHA', 'BUCHAS', 2)).toBe(1);
  });
  it('fonética aproxima grafias do mesmo som', () => {
    expect(fonetica('BUXA')).toBe(fonetica('BUCHA'));
    expect(fonetica('PARAFUZO')).toBe(fonetica('PARAFUSO'));
  });
});

describe('busca no catálogo', () => {
  it('acha plural e singular', () => {
    expect(descricoes('pastilhas')).toContain('PASTILHA FREIO DT KIA');
    expect(descricoes('parafusos')).toContain('PARAFUSO');
  });

  it('acha por abreviação nos dois sentidos', () => {
    expect(descricoes('bucha mola dianteira')).toContain('BUCHA MOLA DT - DAF NEW');
    expect(descricoes('bucha mola dianteira')).not.toContain('BUCHA MOLA TZ - MB ATEGO');
    expect(descricoes('pastilha dt')).toContain('SYL 2341 - PASTILHA FREIO DIANTEIRA RENAULT MASTER');
    expect(descricoes('amortecedor traseiro')).toEqual(['AMORTECEDOR TZ FORD CARGO']);
    expect(descricoes('lona carreta 3 eixo esquerdo')).toEqual(['SERVIÇO TROCA DE LONA CARRETA 3º EX LE']);
  });

  it('perdoa erro de digitação e marca como parecido', () => {
    const hits = buscarNoIndice(catalogo, 'amortecdor');
    expect(hits.map((h) => h.entry.descricao)).toEqual(['AMORTECEDOR TZ FORD CARGO']);
    expect(hits[0]!.parecido).toBe(true);
    expect(buscarNoIndice(catalogo, 'amortecedor')[0]!.parecido).toBe(false);
    expect(descricoes('buxa mola')).toContain('BUCHA MOLA DT - DAF NEW');
    expect(descricoes('parafuzo')).toEqual(['PARAFUSO']);
  });

  it('não confunde marcas parecidas', () => {
    expect(descricoes('coxim volvo')).toEqual(['COXIM TZ MOTOR VOLVO FH - COMPLETO']);
  });

  it('medidas com ou sem separador são a mesma coisa', () => {
    for (const termo of ['15w40', '15w-40', '15 w 40']) expect(descricoes(termo)).toEqual(['OLEO MOTOR 15W-40 LITRO']);
    expect(descricoes('soquete 3/4')).toEqual(['SOQUETE IMPACTO CURTO SEXT. 3/4 SATA 30MM']);
    expect(descricoes('soquete sextavado')).toEqual(['SOQUETE IMPACTO CURTO SEXT. 3/4 SATA 30MM']);
  });

  it('código funciona com ou sem zeros à esquerda e vem primeiro', () => {
    expect(descricoes('1572')[0]).toBe('ARAME MIG / SOLDA - REGULADOR');
    expect(descricoes('001572')[0]).toBe('ARAME MIG / SOLDA - REGULADOR');
  });

  it('acha com cedilha e sem, e balança como substantivo principal vem antes', () => {
    for (const termo of ['balança', 'balanca', 'BALANÇAS']) {
      const lista = descricoes(termo);
      expect(lista).toContain('BALANÇA CAR. LIBRELATO LUBFREE');
      expect(lista[0]).toMatch(/^BALANÇA CAR\./);
    }
  });

  it('ordem das palavras não importa', () => {
    expect(descricoes('freio pastilha')).toContain('PASTILHA FREIO DT KIA');
  });

  it('palavra que começa com o termo vem antes de trecho no meio de outra', () => {
    const lista = descricoes('aro');
    expect(lista[0]).toBe('AROMATIZANTE C/ VARETA 30 ML');
    expect(lista.indexOf('REPARO CATRACA FREIO')).toBeGreaterThan(0);
  });

  it('sem resultado com todas as palavras, mostra os que casam com todas menos uma (parecido)', () => {
    const hits = buscarNoIndice(catalogo, 'pastilha freio xyzabc');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.parecido)).toBe(true);
  });

  it('erro de digitação não aparece quando já há muitos resultados exatos', () => {
    const muitos = construirIndice([
      ...Array.from({ length: 10 }, (_, i) => ({ codigo: `${i}`, descricao: `BUCHA MODELO ${i}` })),
      { codigo: '99', descricao: 'BUCHAS ESPECIAIS' },
      { codigo: '98', descricao: 'BUXA ANTIGA' },
    ]);
    const nomes = buscarNoIndice(muitos, 'bucha').map((h) => h.entry.descricao);
    expect(nomes).not.toContain('BUXA ANTIGA');
    expect(nomes).toContain('BUCHAS ESPECIAIS');
  });

  it('filtro de tipo e ordenação escolhida', () => {
    const soTipo01 = buscarNoIndice(catalogo, 'lona', { filtro: (e) => e.tipo === '01' });
    expect(soTipo01.map((h) => h.entry.codigo)).toEqual(['000239']);
    const porCodigo = ordenarHits(buscarNoIndice(catalogo, 'bucha'), 'codigo', 'desc').map((h) => h.entry.codigo);
    expect(porCodigo).toEqual([...porCodigo].sort().reverse());
  });

  it('termo vazio ou só com palavras de ligação não quebra', () => {
    expect(buscarNoIndice(catalogo, '')).toEqual([]);
    expect(buscarNoIndice(catalogo, '   ')).toEqual([]);
    expect(() => buscarNoIndice(catalogo, 'de da do')).not.toThrow();
  });

  it('é rápido com 5 mil itens', () => {
    const grande = construirIndice(
      Array.from({ length: 5000 }, (_, i) => ({ codigo: String(i).padStart(6, '0'), descricao: `PECA ${i} BUCHA MOLA DT MODELO ${i % 97} SCANIA` })),
    );
    const inicio = performance.now();
    buscarNoIndice(grande, 'bucha molas dianteira scania');
    buscarNoIndice(grande, 'buxa mlas dt');
    expect(performance.now() - inicio).toBeLessThan(400);
  });
});
