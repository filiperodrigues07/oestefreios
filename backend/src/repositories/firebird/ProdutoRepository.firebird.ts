import { firebirdQuery } from '../../database/firebird/pool.js';
import { catalogSearchCondition, catalogTextColumn } from './catalogSearch.js';
import { NotImplementedError } from '../../errors/NotImplementedError.js';
import { buscarRanqueado, CatalogIndexCache } from '../../services/catalogIndex.service.js';
import type { PaginatedResult, Produto, SearchQuery } from '../../types/cherp.types.js';
import { normalizeCatalogText } from '../../utils/catalogSearch.js';
import { ordenarHits, type CatalogHit, type CatalogItemInput } from '../../utils/catalogEngine.js';
import { logger } from '../../utils/logger.js';
import type { IProdutoRepository } from '../interfaces/IProdutoRepository.js';

/**
 * Implementação real contra o Firebird/CHERP (schema Questor). Produtos e serviços
 * moram na mesma tabela PRODUTO — TIPO = 9 é serviço (ver PRODUTOTIPO.CODIGO = 9
 * "SERVIÇOS"), qualquer outro TIPO é produto/mercadoria. Preço vem de PRODUTOVENDA
 * e custo de PRODUTOCUSTO (uma linha por tabela de preço; pegamos a primeira ativa
 * por produto via subquery FIRST 1). Estoque soma PRODUTOESTOQUE por não haver
 * filtro de depósito no contrato desta fase; estoque mínimo pega a primeira linha
 * ativa (raramente há mais de um depósito configurado nesse porte de oficina).
 * Categoria vem de GRUPOPRODUTO via CHAVEGRUPO.
 *
 * As colunas de texto (DESCRICAO) têm charset NONE no banco real mas contêm bytes
 * Windows-1252 — por isso o CAST ... CHARACTER SET OCTETS (decodificado como latin1
 * em `database/firebird/encoding.ts`). Termos de busca com acento entram como
 * Buffer latin1 (`toLatin1Param`), não como string, pelo mesmo motivo.
 */

const PRODUTO_SELECT = `
  P.CODIGO AS CODIGO,
  CAST(P.DESCRICAO AS VARCHAR(100) CHARACTER SET OCTETS) AS DESCRICAO,
  U.UNMAIOR AS UNIDADE,
  CAST(G.DESCRICAO AS VARCHAR(100) CHARACTER SET OCTETS) AS CATEGORIA,
  CAST(PT.DESCRICAO AS VARCHAR(100) CHARACTER SET OCTETS) AS TIPO_DESCRICAO,
  (SELECT SUM(PE.SALDO) FROM PRODUTOESTOQUE PE WHERE PE.CHAVEPRODUTO = P.CHAVE AND PE.ATIVO = 1) AS DISPONIVEL,
  (SELECT FIRST 1 PE2.ESTOQUEMINIMO FROM PRODUTOESTOQUE PE2 WHERE PE2.CHAVEPRODUTO = P.CHAVE AND PE2.ATIVO = 1 ORDER BY PE2.CHAVE) AS ESTOQUE_MINIMO,
  PV.PRECOVENDA AS PRECO_UNITARIO,
  PC.PRECOCUSTO AS CUSTO
FROM PRODUTO P
LEFT JOIN UNIDADE U ON U.CHAVE = P.CHAVEUNIDADE
LEFT JOIN GRUPOPRODUTO G ON G.CHAVE = P.CHAVEGRUPO
LEFT JOIN PRODUTOTIPO PT ON PT.CODIGO = P.TIPO AND PT.ATIVO = 1
LEFT JOIN PRODUTOVENDA PV ON PV.CHAVE = (
  SELECT FIRST 1 PV2.CHAVE FROM PRODUTOVENDA PV2
  WHERE PV2.CHAVEPRODUTO = P.CHAVE AND PV2.ATIVO = 1
  ORDER BY PV2.CHAVETABELAPRECO
)
LEFT JOIN PRODUTOCUSTO PC ON PC.CHAVE = (
  SELECT FIRST 1 PC2.CHAVE FROM PRODUTOCUSTO PC2
  WHERE PC2.CHAVEPRODUTO = P.CHAVE AND PC2.ATIVO = 1
  ORDER BY PC2.CHAVE
)`;

// TRIM LEADING '0' em ambos os lados: código real é zero-padded (ex. "001258") mas o usuário
// digita sem os zeros na busca exata (ex. "1258") — comparar ignorando os zeros à esquerda.
const QUERY_BUSCAR_POR_CODIGO: string | null = `
  SELECT ${PRODUTO_SELECT}
  WHERE P.ATIVO = 1 AND P.TIPO <> 9 AND TRIM(LEADING '0' FROM P.CODIGO) = TRIM(LEADING '0' FROM ?)
`;

// A condição da busca é montada por palavra em catalogSearchCondition.
// Paginação e ordenação são completadas em buscar() após os filtros por palavra.
const QUERY_BUSCAR_PAGINADO_BASE: string | null = `
  SELECT FIRST ? SKIP ? ${PRODUTO_SELECT}
  WHERE P.ATIVO = 1 AND P.TIPO <> 9
`;

const QUERY_CONTAR_TOTAL: string | null = `
  SELECT COUNT(*) AS TOTAL
  FROM PRODUTO P
  LEFT JOIN GRUPOPRODUTO G ON G.CHAVE = P.CHAVEGRUPO
  LEFT JOIN PRODUTOTIPO PT ON PT.CODIGO = P.TIPO AND PT.ATIVO = 1
  WHERE P.ATIVO = 1 AND P.TIPO <> 9
`;

/** sortBy/sortOrder já vêm validados por enum no zod (search.validator.ts) — seguro interpolar direto. */
function buildOrderBy(query: SearchQuery): string {
  const coluna =
    query.sortBy === 'codigo' ? 'P.CODIGO' :
    query.sortBy === 'categoria' ? 'G.DESCRICAO' :
    query.sortBy === 'tipo' ? 'PT.DESCRICAO' :
    'P.DESCRICAO';
  const direcao = query.sortOrder === 'desc' ? 'DESC' : 'ASC';
  return `${coluna} ${direcao}`;
}

function mapRowToProduto(row: Record<string, unknown>): Produto {
  return {
    // CHERP usa códigos com zeros à esquerda — nunca converter para number (ver seção 36 do briefing).
    codigo: String(row.CODIGO ?? row.codigo),
    descricao: String(row.DESCRICAO ?? row.descricao),
    unidade: String(row.UNIDADE ?? row.unidade),
    categoria: row.CATEGORIA ? String(row.CATEGORIA) : undefined,
    tipo: row.TIPO_DESCRICAO ? String(row.TIPO_DESCRICAO) : undefined,
    disponivel: row.DISPONIVEL !== undefined && row.DISPONIVEL !== null ? Number(row.DISPONIVEL) : undefined,
    estoqueMinimo:
      row.ESTOQUE_MINIMO !== undefined && row.ESTOQUE_MINIMO !== null ? Number(row.ESTOQUE_MINIMO) : undefined,
    precoUnitario: row.PRECO_UNITARIO !== undefined ? Number(row.PRECO_UNITARIO) : undefined,
    custo: row.CUSTO !== undefined ? Number(row.CUSTO) : undefined,
  };
}

/** Só o texto do catálogo (sem preço/saldo, que mudam toda hora e vêm do banco na hora da consulta). */
async function carregarCatalogoProdutos(): Promise<CatalogItemInput[]> {
  const rows = await firebirdQuery<Record<string, unknown>>(`
    SELECT P.CODIGO AS CODIGO, P.TIPO AS TIPO,
      CAST(P.DESCRICAO AS VARCHAR(100) CHARACTER SET OCTETS) AS DESCRICAO,
      CAST(G.DESCRICAO AS VARCHAR(100) CHARACTER SET OCTETS) AS CATEGORIA,
      CAST(PT.DESCRICAO AS VARCHAR(100) CHARACTER SET OCTETS) AS TIPO_DESCRICAO
    FROM PRODUTO P
    LEFT JOIN GRUPOPRODUTO G ON G.CHAVE = P.CHAVEGRUPO
    LEFT JOIN PRODUTOTIPO PT ON PT.CODIGO = P.TIPO AND PT.ATIVO = 1
    WHERE P.ATIVO = 1 AND P.TIPO <> 9`);
  return rows.map((row) => ({
    codigo: String(row.CODIGO).trim(),
    descricao: String(row.DESCRICAO ?? ''),
    grupo: row.CATEGORIA ? String(row.CATEGORIA) : undefined,
    tipoTexto: row.TIPO_DESCRICAO ? String(row.TIPO_DESCRICAO) : undefined,
    tipo: row.TIPO === null || row.TIPO === undefined ? undefined : Number(row.TIPO),
  }));
}

const indiceProdutos = new CatalogIndexCache(carregarCatalogoProdutos);

/** Mesmo filtro de saldo do SQL de listagem — repetido aqui porque DISPONIVEL é subquery, não coluna. */
function saldoClauseFor(modo: SearchQuery['saldoModo']): string {
  switch (modo) {
    case 'com_saldo': return ` AND (SELECT SUM(PE.SALDO) FROM PRODUTOESTOQUE PE WHERE PE.CHAVEPRODUTO = P.CHAVE AND PE.ATIVO = 1) > 0`;
    case 'sem_saldo': return ` AND COALESCE((SELECT SUM(PE.SALDO) FROM PRODUTOESTOQUE PE WHERE PE.CHAVEPRODUTO = P.CHAVE AND PE.ATIVO = 1), 0) = 0`;
    case 'negativo': return ` AND (SELECT SUM(PE.SALDO) FROM PRODUTOESTOQUE PE WHERE PE.CHAVEPRODUTO = P.CHAVE AND PE.ATIVO = 1) < 0`;
    default: return '';
  }
}

/** Com filtro de saldo, só os melhores resultados da busca são checados no banco (a lista nunca passa disso). */
const LIMITE_COM_FILTRO_SALDO = 300;

export class ProdutoRepositoryFirebird implements IProdutoRepository {
  async listarTipos(): Promise<{ codigo: number; descricao: string }[]> {
    const rows = await firebirdQuery<{ CODIGO: number; DESCRICAO: string }>(`
      SELECT DISTINCT PT.CODIGO AS CODIGO,
        CAST(PT.DESCRICAO AS VARCHAR(100) CHARACTER SET OCTETS) AS DESCRICAO
      FROM PRODUTO P
      JOIN PRODUTOTIPO PT ON PT.CODIGO = P.TIPO AND PT.ATIVO = 1
      WHERE P.ATIVO = 1 AND P.TIPO <> 9
      ORDER BY DESCRICAO
    `, []);
    return rows.map((row) => ({ codigo: Number(row.CODIGO), descricao: String(row.DESCRICAO) }));
  }

  async buscarPorCodigo(codigo: string): Promise<Produto | null> {
    if (!QUERY_BUSCAR_POR_CODIGO) throw new NotImplementedError('ProdutoRepository.buscarPorCodigo');
    const rows = await firebirdQuery(QUERY_BUSCAR_POR_CODIGO, [codigo.trim()]);
    return rows[0] ? mapRowToProduto(rows[0]) : null;
  }

  async buscarPorDescricao(descricao: string): Promise<Produto[]> {
    try {
      const hits = (await buscarRanqueado(indiceProdutos, descricao)).slice(0, 50);
      return await this.carregarDetalhes(hits);
    } catch (err) {
      logger.warn({ err }, 'Busca ranqueada de produtos indisponível; usando SQL');
    }
    const busca = catalogSearchCondition(descricao, ['P.DESCRICAO', 'G.DESCRICAO', 'PT.DESCRICAO']);
    const rows = await firebirdQuery(`SELECT ${PRODUTO_SELECT} WHERE P.ATIVO = 1 AND P.TIPO <> 9 AND ${busca.clause}`, busca.params);
    return rows.map(mapRowToProduto);
  }

  /** Preço, saldo e unidade atuais dos itens achados, na ordem do ranking. */
  private async carregarDetalhes(hits: CatalogHit[], extraClause = ''): Promise<Produto[]> {
    if (!hits.length) return [];
    const marcadores = hits.map(() => '?').join(', ');
    const rows = await firebirdQuery(
      `SELECT ${PRODUTO_SELECT} WHERE P.ATIVO = 1 AND P.TIPO <> 9 AND P.CODIGO IN (${marcadores})${extraClause}`,
      hits.map((h) => h.entry.codigo),
    );
    const porCodigo = new Map(rows.map(mapRowToProduto).map((produto) => [produto.codigo.trim(), produto]));
    return hits.flatMap((hit) => {
      const produto = porCodigo.get(hit.entry.codigo);
      return produto ? [{ ...produto, ...(hit.parecido ? { parecido: true } : {}) }] : [];
    });
  }

  private async buscarRanqueadoPaginado(query: SearchQuery, termo: string): Promise<PaginatedResult<Produto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const tipoCodigo = query.tipoCodigo;
    const filtro = tipoCodigo === undefined
      ? undefined
      : (entry: { tipo?: string | number }) => (query.tipoModo === 'exceto' ? entry.tipo !== tipoCodigo : entry.tipo === tipoCodigo);
    const hits = ordenarHits(await buscarRanqueado(indiceProdutos, termo, { filtro }), query.sortBy, query.sortOrder);

    if (query.saldoModo && query.saldoModo !== 'todos') {
      const itens = await this.carregarDetalhes(hits.slice(0, LIMITE_COM_FILTRO_SALDO), saldoClauseFor(query.saldoModo));
      return { items: itens.slice(skip, skip + limit), page, limit, total: itens.length };
    }
    return { items: await this.carregarDetalhes(hits.slice(skip, skip + limit)), page, limit, total: hits.length };
  }

  async buscar(query: SearchQuery): Promise<PaginatedResult<Produto>> {
    const termo = (query.busca ?? query.codigo ?? query.descricao ?? '').trim();
    if (termo) {
      try {
        return await this.buscarRanqueadoPaginado(query, termo);
      } catch (err) {
        // Índice/consulta indisponível não pode deixar o balcão sem busca: cai no LIKE do banco.
        logger.warn({ err }, 'Busca ranqueada de produtos indisponível; usando SQL');
      }
    }
    return this.buscarSql(query);
  }

  async buscarSql(query: SearchQuery): Promise<PaginatedResult<Produto>> {
    if (!QUERY_BUSCAR_PAGINADO_BASE || !QUERY_CONTAR_TOTAL) throw new NotImplementedError('ProdutoRepository.buscar');
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    // Aceita `busca` (novo, unificado) ou os antigos `codigo`/`descricao` isolados pra não quebrar
    // quem ainda manda um dos dois — o termo efetivo é o primeiro que vier preenchido.
    const termo = query.busca ?? query.codigo ?? query.descricao ?? null;
    const buscaFlag = termo ? termo.trim() : null;
    const busca = catalogSearchCondition(buscaFlag ?? '', ['P.DESCRICAO', 'G.DESCRICAO', 'PT.DESCRICAO']);
    const tipoClause = query.tipoCodigo === undefined
      ? ''
      : ` AND P.TIPO ${query.tipoModo === 'exceto' ? '<>' : '='} ?`;
    // DISPONIVEL é subquery correlacionada (ver mapRowToProduto/PRODUTO_SELECT), não uma coluna —
    // QUERY_CONTAR_TOTAL não seleciona ela, então repete a mesma expressão aqui em vez de comparar
    // por alias (não existe alias pra comparar fora do SELECT).
    const saldoClause = saldoClauseFor(query.saldoModo);
    const extraClause = `${tipoClause}${saldoClause}`;
    const params = query.tipoCodigo === undefined ? busca.params : [...busca.params, query.tipoCodigo];
    const relevancia = buscaFlag && (query.busca || query.descricao) ? `CASE WHEN ${catalogTextColumn('P.DESCRICAO')} LIKE ? THEN 0 ELSE 1 END, ` : '';
    const queryPaginada = `${QUERY_BUSCAR_PAGINADO_BASE} AND ${busca.clause}${extraClause} ORDER BY ${relevancia}${buildOrderBy(query)}`;
    const pageParams = [limit, skip, ...params, ...(relevancia ? [`%${normalizeCatalogText(buscaFlag!)}%`] : [])];

    const [rows, countRows] = await Promise.all([
      firebirdQuery(queryPaginada, pageParams),
      firebirdQuery<{ TOTAL: number }>(`${QUERY_CONTAR_TOTAL} AND ${busca.clause}${extraClause}`, params),
    ]);

    return {
      items: rows.map(mapRowToProduto),
      page,
      limit,
      total: Number(countRows[0]?.TOTAL ?? 0),
    };
  }
}
