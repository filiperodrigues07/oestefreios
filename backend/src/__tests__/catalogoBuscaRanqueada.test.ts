import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../database/firebird/pool.js', () => ({ firebirdQuery: vi.fn() }));

const catalogo = [
  { CODIGO: '000943 ', TIPO: 0, DESCRICAO: 'BALANÇA CAR. FACCHINI 51', CATEGORIA: null, TIPO_DESCRICAO: null },
  { CODIGO: '001899', TIPO: 0, DESCRICAO: 'BALANÇA CAR. LIBRELATO LUBFREE', CATEGORIA: null, TIPO_DESCRICAO: null },
  { CODIGO: '000083', TIPO: 0, DESCRICAO: 'BUCHA BALANÇA 50MM', CATEGORIA: null, TIPO_DESCRICAO: null },
  { CODIGO: '000777', TIPO: 7, DESCRICAO: 'AMORTECEDOR TZ FORD CARGO', CATEGORIA: null, TIPO_DESCRICAO: null },
];

const detalhe = (codigo: string, descricao: string, disponivel: number) => ({ CODIGO: codigo, DESCRICAO: descricao, UNIDADE: 'UN', DISPONIVEL: disponivel, PRECO_UNITARIO: 10 });

async function carregarRepositorio() {
  vi.resetModules();
  const pool = await import('../database/firebird/pool.js');
  const { ProdutoRepositoryFirebird } = await import('../repositories/firebird/ProdutoRepository.firebird.js');
  return { firebirdQuery: vi.mocked(pool.firebirdQuery), repo: new ProdutoRepositoryFirebird() };
}

describe('busca ranqueada de produtos (Firebird)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('acha "balança" com cedilha, mantém produto sem saldo e traz preço/saldo atuais do banco', async () => {
    const { firebirdQuery, repo } = await carregarRepositorio();
    firebirdQuery
      .mockResolvedValueOnce(catalogo) // carga do índice
      .mockResolvedValueOnce([detalhe('001899', 'BALANÇA CAR. LIBRELATO LUBFREE', 0), detalhe('000943', 'BALANÇA CAR. FACCHINI 51', 1), detalhe('000083', 'BUCHA BALANÇA 50MM', 4)]);

    const resultado = await repo.buscar({ busca: 'balança', page: 1, limit: 30 });

    expect(resultado.total).toBe(3);
    expect(resultado.items.map((p) => p.codigo)).toContain('001899');
    const produto = resultado.items.find((p) => p.codigo === '001899')!;
    expect(produto.disponivel).toBe(0);
    // O SQL de detalhes só leva códigos: nenhum texto com acento vai como parâmetro.
    const [sqlDetalhe, params] = firebirdQuery.mock.calls[1]!;
    expect(String(sqlDetalhe)).toContain('P.CODIGO IN (');
    expect(params).toEqual(expect.arrayContaining(['000943', '001899', '000083']));
    expect((params as string[]).every((p) => /^[0-9]+$/.test(p))).toBe(true);
  });

  it('carrega o catálogo uma vez só e reaproveita nas buscas seguintes', async () => {
    const { firebirdQuery, repo } = await carregarRepositorio();
    firebirdQuery.mockResolvedValueOnce(catalogo).mockResolvedValue([detalhe('001899', 'BALANÇA CAR. LIBRELATO LUBFREE', 2)]);

    await repo.buscar({ busca: 'librelato', limit: 10 });
    await repo.buscar({ busca: 'librelato lubfree', limit: 10 });

    const cargas = firebirdQuery.mock.calls.filter(([sql]) => String(sql).includes('FROM PRODUTO P') && !String(sql).includes('IN ('));
    expect(cargas).toHaveLength(1);
  });

  it('erro de digitação volta marcado como parecido', async () => {
    const { firebirdQuery, repo } = await carregarRepositorio();
    firebirdQuery.mockResolvedValueOnce(catalogo).mockResolvedValueOnce([detalhe('000777', 'AMORTECEDOR TZ FORD CARGO', 3)]);

    const resultado = await repo.buscar({ busca: 'amortecdor', limit: 10 });

    expect(resultado.items).toHaveLength(1);
    expect(resultado.items[0]!.parecido).toBe(true);
  });

  it('filtro de tipo vale na busca ranqueada', async () => {
    const { firebirdQuery, repo } = await carregarRepositorio();
    firebirdQuery.mockResolvedValueOnce(catalogo).mockResolvedValueOnce([detalhe('000777', 'AMORTECEDOR TZ FORD CARGO', 3)]);

    const resultado = await repo.buscar({ busca: 'amortecedor', tipoCodigo: 7, tipoModo: 'somente', limit: 10 });
    expect(resultado.total).toBe(1);

    const outra = await carregarRepositorio();
    outra.firebirdQuery.mockResolvedValueOnce(catalogo);
    const excluido = await outra.repo.buscar({ busca: 'amortecedor', tipoCodigo: 7, tipoModo: 'exceto', limit: 10 });
    expect(excluido.total).toBe(0);
  });

  it('se o índice não carregar, cai no SQL antigo em vez de deixar o balcão sem busca', async () => {
    const { firebirdQuery, repo } = await carregarRepositorio();
    firebirdQuery
      .mockRejectedValueOnce(new Error('Firebird fora do ar')) // carga do índice
      .mockResolvedValueOnce([detalhe('001899', 'BALANÇA CAR. LIBRELATO LUBFREE', 0)]) // página (SQL antigo)
      .mockResolvedValueOnce([{ TOTAL: 1 }]); // contagem (SQL antigo)

    const resultado = await repo.buscar({ busca: 'balança', limit: 10 });

    expect(resultado.total).toBe(1);
    expect(resultado.items[0]!.codigo).toBe('001899');
  });

  it('SQL antigo nunca manda texto com acento como parâmetro (dava "Malformed string" com "balança")', async () => {
    const { firebirdQuery, repo } = await carregarRepositorio();
    firebirdQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{ TOTAL: 0 }]);

    await repo.buscarSql({ busca: 'balança', limit: 10 });

    const [, params] = firebirdQuery.mock.calls[0]!;
    const textos = (params as unknown[]).filter((p): p is string => typeof p === 'string');
    expect(textos.length).toBeGreaterThan(0);
    // eslint-disable-next-line no-control-regex
    expect(textos.every((t) => /^[\x00-\x7f]*$/.test(t))).toBe(true);
  });
});
