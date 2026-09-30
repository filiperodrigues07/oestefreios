import { firebirdQuery } from '../../database/firebird/pool.js';
import { catalogSearchCondition, catalogTextColumn } from './catalogSearch.js';
import { NotImplementedError } from '../../errors/NotImplementedError.js';
import { buscarRanqueado, CatalogIndexCache } from '../../services/catalogIndex.service.js';
import type { PaginatedResult, SearchQuery, Servico } from '../../types/cherp.types.js';
import { normalizeCatalogText } from '../../utils/catalogSearch.js';
import { ordenarHits, type CatalogHit, type CatalogItemInput } from '../../utils/catalogEngine.js';
import { logger } from '../../utils/logger.js';
import { criarTtlCache } from '../../utils/ttlCache.js';
import type { IServicoRepository } from '../interfaces/IServicoRepository.js';

/**
 * Ver ProdutoRepository.firebird.ts para o padrão geral e para a explicação do
 * charset (CAST ... OCTETS + toLatin1Param). Serviços moram na mesma tabela
 * PRODUTO do produto, só que com TIPO = 9 (PRODUTOTIPO.CODIGO = 9 "SERVIÇOS").
 * Categoria vem de GRUPOPRODUTO via CHAVEGRUPO, igual produto. CHERP não tem
 * campo de "tempo estimado" pra serviço nesse schema — fora do contrato.
 */

const SERVICO_SELECT = `
  P.CODIGO AS CODIGO,
  CAST(P.DESCRICAO AS VARCHAR(100) CHARACTER SET OCTETS) AS DESCRICAO,
  U.UNMAIOR AS UNIDADE,
  CAST(G.DESCRICAO AS VARCHAR(100) CHARACTER SET OCTETS) AS CATEGORIA,
  TS.CODIGO AS TIPO_SERVICO_CODIGO,
  CAST(TS.DESCRICAO AS VARCHAR(500) CHARACTER SET OCTETS) AS TIPO_SERVICO_DESCRICAO,
  PV.PRECOVENDA AS VALOR_UNITARIO
FROM PRODUTO P
LEFT JOIN UNIDADE U ON U.CHAVE = P.CHAVEUNIDADE
LEFT JOIN GRUPOPRODUTO G ON G.CHAVE = P.CHAVEGRUPO
LEFT JOIN PRODTIPOSERV TS ON TS.CHAVE = P.CHAVETIPOSERV
LEFT JOIN PRODUTOVENDA PV ON PV.CHAVE = (
  SELECT FIRST 1 PV2.CHAVE FROM PRODUTOVENDA PV2
  WHERE PV2.CHAVEPRODUTO = P.CHAVE AND PV2.ATIVO = 1
  ORDER BY PV2.CHAVETABELAPRECO
)`;

// TRIM LEADING '0' em ambos os lados: código real é zero-padded (ex. "000320") mas o usuário
// digita sem os zeros na busca exata (ex. "320") — comparar ignorando os zeros à esquerda.
const QUERY_BUSCAR_POR_CODIGO: string | null = `
  SELECT ${SERVICO_SELECT}
  WHERE P.ATIVO = 1 AND P.TIPO = 9 AND TRIM(LEADING '0' FROM P.CODIGO) = TRIM(LEADING '0' FROM ?)
`;

// A condição da busca é montada por palavra em catalogSearchCondition.
// Paginação e ordenação são completadas em buscar() após os filtros por palavra.
const QUERY_BUSCAR_PAGINADO_BASE: string | null = `
  SELECT FIRST ? SKIP ? ${SERVICO_SELECT}
  WHERE P.ATIVO = 1 AND P.TIPO = 9
`;

const QUERY_CONTAR_TOTAL: string | null = `
  SELECT COUNT(*) AS TOTAL
  FROM PRODUTO P
  LEFT JOIN GRUPOPRODUTO G ON G.CHAVE = P.CHAVEGRUPO
  LEFT JOIN PRODTIPOSERV TS ON TS.CHAVE = P.CHAVETIPOSERV
  WHERE P.ATIVO = 1 AND P.TIPO = 9
`;

/** sortBy/sortOrder já vêm validados por enum no zod (search.validator.ts) — seguro interpolar direto. */
function buildOrderBy(query: SearchQuery): string {
  const coluna = query.sortBy === 'codigo' ? 'P.CODIGO' : query.sortBy === 'categoria' ? 'G.DESCRICAO' : query.sortBy === 'tipo' ? 'TS.CODIGO' : 'P.DESCRICAO';
  const direcao = query.sortOrder === 'desc' ? 'DESC' : 'ASC';
  return `${coluna} ${direcao}`;
}

function mapRowToServico(row: Record<string, unknown>): Servico {
  return {
    codigo: String(row.CODIGO ?? row.codigo),
    descricao: String(row.DESCRICAO ?? row.descricao),
    unidade: String(row.UNIDADE ?? row.unidade),
    categoria: row.CATEGORIA ? String(row.CATEGORIA) : undefined,
    tipoServicoCodigo: row.TIPO_SERVICO_CODIGO ? String(row.TIPO_SERVICO_CODIGO).trim() : undefined,
    tipoServicoDescricao: row.TIPO_SERVICO_DESCRICAO ? String(row.TIPO_SERVICO_DESCRICAO) : undefined,
    valorUnitario: row.VALOR_UNITARIO !== undefined ? Number(row.VALOR_UNITARIO) : undefined,
  };
}

/** Só o texto do catálogo de serviços (o valor vem do banco na hora da consulta). */
async function carregarCatalogoServicos(): Promise<CatalogItemInput[]> {
  const rows = await firebirdQuery<Record<string, unknown>>(`
    SELECT P.CODIGO AS CODIGO, TS.CODIGO AS TIPO_SERVICO_CODIGO,
      CAST(P.DESCRICAO AS VARCHAR(100) CHARACTER SET OCTETS) AS DESCRICAO,
      CAST(G.DESCRICAO AS VARCHAR(100) CHARACTER SET OCTETS) AS CATEGORIA
    FROM PRODUTO P
    LEFT JOIN GRUPOPRODUTO G ON G.CHAVE = P.CHAVEGRUPO
    LEFT JOIN PRODTIPOSERV TS ON TS.CHAVE = P.CHAVETIPOSERV
    WHERE P.ATIVO = 1 AND P.TIPO = 9`);
  return rows.map((row) => {
    const tipo = row.TIPO_SERVICO_CODIGO ? String(row.TIPO_SERVICO_CODIGO).trim() : undefined;
    return {
      codigo: String(row.CODIGO).trim(),
      descricao: String(row.DESCRICAO ?? ''),
      grupo: row.CATEGORIA ? String(row.CATEGORIA) : undefined,
      // O código do tipo de serviço também é pesquisável (como no SQL antigo).
      tipoTexto: tipo,
      tipo,
    };
  });
}

const indiceServicos = new CatalogIndexCache(carregarCatalogoServicos);

/** Tipos mudam raramente e a query varre PRODUTO inteira (DISTINCT): 1 min de cache basta pros filtros/combos. */
const cacheTiposServico = criarTtlCache<{ codigo: string; descricao: string }[]>(60_000, 1);

export class ServicoRepositoryFirebird implements IServicoRepository {
  listarTipos(): Promise<{ codigo: string; descricao: string }[]> {
    return cacheTiposServico.obter('tipos', () => this.carregarTipos());
  }

  private async carregarTipos(): Promise<{ codigo: string; descricao: string }[]> {
    const rows = await firebirdQuery<{ CODIGO: string; DESCRICAO: string }>(`
      SELECT DISTINCT TS.CODIGO AS CODIGO,
        CAST(TS.DESCRICAO AS VARCHAR(500) CHARACTER SET OCTETS) AS DESCRICAO
      FROM PRODUTO P
      JOIN PRODTIPOSERV TS ON TS.CHAVE = P.CHAVETIPOSERV
      WHERE P.ATIVO = 1 AND P.TIPO = 9
      ORDER BY TS.CODIGO
    `);
    return rows.map((row) => ({ codigo: String(row.CODIGO).trim(), descricao: String(row.DESCRICAO) }));
  }

  async buscarPorCodigo(codigo: string): Promise<Servico | null> {
    if (!QUERY_BUSCAR_POR_CODIGO) throw new NotImplementedError('ServicoRepository.buscarPorCodigo');
    const rows = await firebirdQuery(QUERY_BUSCAR_POR_CODIGO, [codigo.trim()]);
    return rows[0] ? mapRowToServico(rows[0]) : null;
  }

  async buscarPorDescricao(descricao: string): Promise<Servico[]> {
    try {
      const hits = (await buscarRanqueado(indiceServicos, descricao)).slice(0, 50);
      return await this.carregarDetalhes(hits);
    } catch (err) {
      logger.warn({ err }, 'Busca ranqueada de serviços indisponível; usando SQL');
    }
    const busca = catalogSearchCondition(descricao, ['P.DESCRICAO', 'G.DESCRICAO', 'TS.CODIGO']);
    const rows = await firebirdQuery(`SELECT ${SERVICO_SELECT} WHERE P.ATIVO = 1 AND P.TIPO = 9 AND ${busca.clause}`, busca.params);
    return rows.map(mapRowToServico);
  }

  /** Valor e unidade atuais dos serviços achados, na ordem do ranking. */
  private async carregarDetalhes(hits: CatalogHit[]): Promise<Servico[]> {
    if (!hits.length) return [];
    const marcadores = hits.map(() => '?').join(', ');
    const rows = await firebirdQuery(
      `SELECT ${SERVICO_SELECT} WHERE P.ATIVO = 1 AND P.TIPO = 9 AND P.CODIGO IN (${marcadores})`,
      hits.map((h) => h.entry.codigo),
    );
    const porCodigo = new Map(rows.map(mapRowToServico).map((servico) => [servico.codigo.trim(), servico]));
    return hits.flatMap((hit) => {
      const servico = porCodigo.get(hit.entry.codigo);
      return servico ? [{ ...servico, ...(hit.parecido ? { parecido: true } : {}) }] : [];
    });
  }

  private async buscarRanqueadoPaginado(query: SearchQuery, termo: string): Promise<PaginatedResult<Servico>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const tipo = query.tipoServicoCodigo;
    const filtro = tipo ? (entry: { tipo?: string | number }) => entry.tipo === tipo : undefined;
    const hits = ordenarHits(await buscarRanqueado(indiceServicos, termo, { filtro }), query.sortBy, query.sortOrder);
    return { items: await this.carregarDetalhes(hits.slice(skip, skip + limit)), page, limit, total: hits.length };
  }

  async buscar(query: SearchQuery): Promise<PaginatedResult<Servico>> {
    const termo = (query.busca ?? query.codigo ?? query.descricao ?? '').trim();
    if (termo) {
      try {
        return await this.buscarRanqueadoPaginado(query, termo);
      } catch (err) {
        // Índice/consulta indisponível não pode deixar o balcão sem busca: cai no LIKE do banco.
        logger.warn({ err }, 'Busca ranqueada de serviços indisponível; usando SQL');
      }
    }
    return this.buscarSql(query);
  }

  async buscarSql(query: SearchQuery): Promise<PaginatedResult<Servico>> {
    if (!QUERY_BUSCAR_PAGINADO_BASE || !QUERY_CONTAR_TOTAL) throw new NotImplementedError('ServicoRepository.buscar');
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const termo = query.busca ?? query.codigo ?? query.descricao ?? null;
    const buscaFlag = termo ? termo.trim() : null;
    const busca = catalogSearchCondition(buscaFlag ?? '', ['P.DESCRICAO', 'G.DESCRICAO', 'TS.CODIGO']);
    const tipoClause = query.tipoServicoCodigo ? ' AND TS.CODIGO = ?' : '';
    const params = query.tipoServicoCodigo ? [...busca.params, query.tipoServicoCodigo] : busca.params;
    const relevancia = buscaFlag && (query.busca || query.descricao) ? `CASE WHEN ${catalogTextColumn('P.DESCRICAO')} LIKE ? THEN 0 ELSE 1 END, ` : '';
    const queryPaginada = `${QUERY_BUSCAR_PAGINADO_BASE} AND ${busca.clause}${tipoClause} ORDER BY ${relevancia}${buildOrderBy(query)}`;
    const pageParams = [limit, skip, ...params, ...(relevancia ? [`%${normalizeCatalogText(buscaFlag!)}%`] : [])];

    const [rows, countRows] = await Promise.all([
      firebirdQuery(queryPaginada, pageParams),
      firebirdQuery<{ TOTAL: number }>(`${QUERY_CONTAR_TOTAL} AND ${busca.clause}${tipoClause}`, params),
    ]);

    return { items: rows.map(mapRowToServico), page, limit, total: Number(countRows[0]?.TOTAL ?? 0) };
  }
}
