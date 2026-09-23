import { env } from '../../config/env.js';
import { toLatin1Param, toLatin1SearchParam } from '../../database/firebird/encoding.js';
import { firebirdQuery, firebirdTransaction } from '../../database/firebird/pool.js';
import { ExternalServiceError } from '../../errors/ExternalServiceError.js';
import { NotFoundError } from '../../errors/NotFoundError.js';
import { NotImplementedError } from '../../errors/NotImplementedError.js';
import { ValidationError } from '../../errors/ValidationError.js';
import type { Cliente, ClienteInput, PaginatedResult, RegimeTributario, SearchQuery } from '../../types/cherp.types.js';
import type { IClienteRepository } from '../interfaces/IClienteRepository.js';

/**
 * Ver ProdutoRepository.firebird.ts para o padrão geral e para a explicação do
 * charset. Clientes/fornecedores moram na tabela CLIFOR (CLIENTE = 'S' marca
 * quem é cliente — o mesmo cadastro também serve para fornecedor/transportador).
 * NOME prioriza o nome fantasia e cai para razão social quando fantasia está
 * vazio; a busca por nome cobre os dois campos. Endereço junta CIDADE (tabela
 * de municípios do IBGE, ~9400 linhas, já vem populada no CHERP) via CHAVECIDADE.
 */

const CHAVE_EMPRESA = 1;

const CLIFOR_SELECT = `
  C.CODIGO AS CODIGO,
  C.ATIVO AS ATIVO,
  C.STATUS AS STATUS,
  CAST(COALESCE(NULLIF(TRIM(C.FANTASIA), ''), C.RAZAOSOCIAL) AS VARCHAR(100) CHARACTER SET OCTETS) AS NOME,
  CAST(C.RAZAOSOCIAL AS VARCHAR(100) CHARACTER SET OCTETS) AS RAZAOSOCIAL,
  CAST(C.FANTASIA AS VARCHAR(100) CHARACTER SET OCTETS) AS FANTASIA,
  C.CNPJCPF AS DOCUMENTO,
  C.IERG AS INSCRICAOESTADUAL,
  C.INSCRICAOMUNICIPAL AS INSCRICAOMUNICIPAL,
  C.REDUCAOMVA AS REDUCAOMVA,
  C.REPRCORE AS COREREPRESENTANTE,
  C.PESSOA AS PESSOA,
  C.TELEFONE AS TELEFONE,
  C.CELULAR AS CELULAR,
  C.EMAIL AS EMAIL,
  C.EMAILFINANCEIRO AS EMAILFINANCEIRO,
  C.EMAILNFECTE AS EMAILNFE,
  C.HOMEPAGE AS HOMEPAGE,
  CAST(C.ENDERECO AS VARCHAR(100) CHARACTER SET OCTETS) AS ENDERECO,
  C.NUMERO AS NUMERO,
  CAST(C.BAIRRO AS VARCHAR(50) CHARACTER SET OCTETS) AS BAIRRO,
  CAST(C.COMPLEMENTO AS VARCHAR(100) CHARACTER SET OCTETS) AS COMPLEMENTO,
  CAST(CID.CIDADE AS VARCHAR(100) CHARACTER SET OCTETS) AS CIDADE,
  CID.UF AS UF,
  C.CEP AS CEP,
  C.FORNECEDOR AS FORNECEDOR,
  C.TRANSPORTADOR AS TRANSPORTADOR,
  C.REPRESENTANTE AS REPRESENTANTE,
  C.REGIMETRIBUTARIO AS REGIMETRIBUTARIO
FROM CLIFOR C
LEFT JOIN CIDADE CID ON CID.CHAVE = C.CHAVECIDADE`;

const QUERY_BUSCAR_POR_CODIGO: string | null = `
  SELECT ${CLIFOR_SELECT}
  WHERE C.CLIENTE = 'S' AND C.CODIGO = ?
`;

const QUERY_BUSCAR_POR_NOME: string | null = `
  SELECT ${CLIFOR_SELECT}
  WHERE C.ATIVO = 1 AND COALESCE(C.STATUS, 0) = 0 AND C.CLIENTE = 'S' AND (UPPER(C.RAZAOSOCIAL) LIKE ? OR UPPER(C.FANTASIA) LIKE ?)
`;

const QUERY_BUSCAR_POR_DOCUMENTO: string | null = `
  SELECT ${CLIFOR_SELECT}
  WHERE C.CLIENTE = 'S'
    AND REPLACE(REPLACE(REPLACE(REPLACE(C.CNPJCPF, '.', ''), '-', ''), '/', ''), ' ', '') = ?
`;

// Parâmetros nesta ordem: limit, skip, codigo|null, nomeLike|null, nomeLike|null, pessoa|null, pessoa|null,
// uf|null, uf|null, buscaFlag|null x1, codigoLike, nomeLike, nomeLike, docLike, telLike, celLike (ver buscar()).
// PESSOA/UF usam "(? IS NULL OR col = ?)" em vez de "col = COALESCE(?, col)" — esse segundo padrão
// falha quando a própria coluna é NULL (ex. cliente sem cidade cadastrada: NULL = NULL não é TRUE em SQL).
// "busca" é livre — casa contra código, nome/razão social, documento e telefone/celular de uma vez,
// igual ao padrão já usado na lista de OS.
// CAST(... AS VARCHAR(n)) SEM "CHARACTER SET OCTETS" pras colunas curtas (CODIGO é só VARCHAR(6) —
// termo de busca mais longo vira erro de truncamento, SQL -303, sem isso). RAZAOSOCIAL/FANTASIA
// ficam sem CAST nenhum — colocar CHARACTER SET OCTETS na própria coluna (em vez de só no literal
// de fallback) quebra o LIKE por completo (mesmo bug já visto na placa: CAST na coluna comparada,
// não no valor, faz o driver parar de casar bytes iguais). Confirmado ao vivo antes desse fix.
const BUSCA_CONDICAO = `
  (
    ? IS NULL OR (
      UPPER(CAST(C.CODIGO AS VARCHAR(50))) LIKE ?
      OR UPPER(C.RAZAOSOCIAL) LIKE ?
      OR UPPER(C.FANTASIA) LIKE ?
      OR CAST(C.CNPJCPF AS VARCHAR(50)) LIKE ?
      OR CAST(C.TELEFONE AS VARCHAR(50)) LIKE ?
      OR CAST(C.CELULAR AS VARCHAR(50)) LIKE ?
    )
  )
`;

const QUERY_BUSCAR_PAGINADO: string | null = `
  SELECT FIRST ? SKIP ? ${CLIFOR_SELECT}
  WHERE C.ATIVO = 1 AND COALESCE(C.STATUS, 0) = 0 AND C.CLIENTE = 'S'
    AND C.CODIGO = COALESCE(?, C.CODIGO)
    AND (UPPER(C.RAZAOSOCIAL) LIKE COALESCE(?, CAST('%' AS VARCHAR(100) CHARACTER SET OCTETS)) OR UPPER(C.FANTASIA) LIKE COALESCE(?, CAST('%' AS VARCHAR(100) CHARACTER SET OCTETS)))
    AND (? IS NULL OR C.PESSOA = ?)
    AND (? IS NULL OR CID.UF = ?)
    AND ${BUSCA_CONDICAO}
`;

const QUERY_CONTAR_TOTAL: string | null = `
  SELECT COUNT(*) AS TOTAL
  FROM CLIFOR C
  LEFT JOIN CIDADE CID ON CID.CHAVE = C.CHAVECIDADE
  WHERE C.ATIVO = 1 AND COALESCE(C.STATUS, 0) = 0 AND C.CLIENTE = 'S'
    AND C.CODIGO = COALESCE(?, C.CODIGO)
    AND (UPPER(C.RAZAOSOCIAL) LIKE COALESCE(?, CAST('%' AS VARCHAR(100) CHARACTER SET OCTETS)) OR UPPER(C.FANTASIA) LIKE COALESCE(?, CAST('%' AS VARCHAR(100) CHARACTER SET OCTETS)))
    AND (? IS NULL OR C.PESSOA = ?)
    AND (? IS NULL OR CID.UF = ?)
    AND ${BUSCA_CONDICAO}
`;

/** Coluna real por trás de cada chave de ordenação aceita pra clientes — nunca interpolar direto o que vem do cliente HTTP. */
const ORDEM_POR_SORT_BY: Record<string, string> = {
  codigo: 'C.CODIGO',
  nome: 'C.RAZAOSOCIAL',
  documento: 'C.CNPJCPF',
  telefone: 'C.TELEFONE',
  cidade: 'CID.CIDADE',
};

function buildOrderBy(sortBy: string | undefined, sortOrder: string | undefined): string {
  const coluna = ORDEM_POR_SORT_BY[sortBy ?? ''] ?? 'C.RAZAOSOCIAL';
  const direcao = sortOrder === 'desc' ? 'DESC' : 'ASC';
  return `${coluna} ${direcao}`;
}

/** CIDADE.CIDADE vem como "NOME (UF)" sem acento (base IBGE) — tira o sufixo pra exibir só o nome. */
function limparNomeCidade(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.replace(/\s*\([A-Z]{2}\)\s*$/, '').trim() || undefined;
}

/** Faixa Unicode "Combining Diacritical Marks" (acentos isolados após normalize('NFD')). */
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** CLIFOR usa CHAR(1) 'S'/'N' — uma amostra real mostrou ' ' (espaço) em vez de 'N', então só 'S' é truthy. */
function paraBoolean(raw: unknown): boolean {
  return String(raw ?? '').trim().toUpperCase() === 'S';
}

function paraSN(valor: boolean | undefined): string {
  return valor ? 'S' : 'N';
}

/** Acha a CHAVE de CIDADE por nome+UF (formato BrasilAPI) — nome sem acento, prefixo antes do " (UF)". */
async function resolveChaveCidade(cidade: string | undefined, uf: string | undefined): Promise<number | null> {
  if (!cidade && !uf) return null;
  if (!cidade || !uf) throw new ValidationError('Informe cidade e UF juntas.');
  const nomeNormalizado = stripAccents(cidade).toUpperCase();
  const rows = await firebirdQuery<{ CHAVE: number }>(
    `SELECT FIRST 1 CHAVE FROM CIDADE WHERE UF = ? AND UPPER(CIDADE) LIKE ?`,
    [uf.toUpperCase(), toLatin1Param(`${nomeNormalizado} (%`)],
  );
  if (!rows[0]) throw new ValidationError(`Cidade "${cidade}/${uf}" não encontrada no CHERP.`);
  return rows[0].CHAVE;
}

function mapRowToCliente(row: Record<string, unknown>): Cliente {
  return {
    codigo: String(row.CODIGO ?? row.codigo),
    ativo: Number(row.ATIVO ?? row.ativo) === 1 && Number(row.STATUS ?? row.status ?? 0) === 0,
    nome: String(row.NOME ?? row.nome),
    razaoSocial: row.RAZAOSOCIAL ? String(row.RAZAOSOCIAL) : undefined,
    nomeFantasia: row.FANTASIA ? String(row.FANTASIA) : undefined,
    documento: row.DOCUMENTO !== undefined && row.DOCUMENTO !== null ? String(row.DOCUMENTO) : undefined,
    tipoPessoa: row.PESSOA === 1 ? 'PF' : 'PJ',
    telefone: row.TELEFONE !== undefined && row.TELEFONE !== null ? String(row.TELEFONE) : undefined,
    celular: row.CELULAR !== undefined && row.CELULAR !== null ? String(row.CELULAR) : undefined,
    email: row.EMAIL ? String(row.EMAIL) : undefined,
    emailFinanceiro: row.EMAILFINANCEIRO ? String(row.EMAILFINANCEIRO) : undefined,
    emailNfe: row.EMAILNFE ? String(row.EMAILNFE) : undefined,
    homePage: row.HOMEPAGE ? String(row.HOMEPAGE) : undefined,
    inscricaoEstadual: row.INSCRICAOESTADUAL ? String(row.INSCRICAOESTADUAL) : undefined,
    inscricaoMunicipal: row.INSCRICAOMUNICIPAL ? String(row.INSCRICAOMUNICIPAL) : undefined,
    reducaoMva: row.REDUCAOMVA !== undefined && row.REDUCAOMVA !== null ? Number(row.REDUCAOMVA) : undefined,
    coreRepresentante: row.COREREPRESENTANTE ? String(row.COREREPRESENTANTE) : undefined,
    endereco: row.ENDERECO ? String(row.ENDERECO) : undefined,
    numero: row.NUMERO ? String(row.NUMERO) : undefined,
    bairro: row.BAIRRO ? String(row.BAIRRO) : undefined,
    complemento: row.COMPLEMENTO ? String(row.COMPLEMENTO) : undefined,
    cidade: limparNomeCidade(row.CIDADE ? String(row.CIDADE) : undefined),
    uf: row.UF ? String(row.UF) : undefined,
    cep: row.CEP ? String(row.CEP) : undefined,
    fornecedor: paraBoolean(row.FORNECEDOR),
    transportador: paraBoolean(row.TRANSPORTADOR),
    representante: paraBoolean(row.REPRESENTANTE),
    regimeTributario:
      row.REGIMETRIBUTARIO !== undefined && row.REGIMETRIBUTARIO !== null
        ? (Number(row.REGIMETRIBUTARIO) as RegimeTributario)
        : undefined,
  };
}

export class ClienteRepositoryFirebird implements IClienteRepository {
  async buscarPorCodigo(codigo: string): Promise<Cliente | null> {
    if (!QUERY_BUSCAR_POR_CODIGO) throw new NotImplementedError('ClienteRepository.buscarPorCodigo');
    const rows = await firebirdQuery(QUERY_BUSCAR_POR_CODIGO, [codigo]);
    return rows[0] ? mapRowToCliente(rows[0]) : null;
  }

  async buscarPorNome(nome: string): Promise<Cliente[]> {
    if (!QUERY_BUSCAR_POR_NOME) throw new NotImplementedError('ClienteRepository.buscarPorNome');
    const nomeLike = toLatin1SearchParam(nome);
    const rows = await firebirdQuery(QUERY_BUSCAR_POR_NOME, [nomeLike, nomeLike]);
    return rows.map(mapRowToCliente);
  }

  async buscarPorDocumento(documento: string): Promise<Cliente | null> {
    if (!QUERY_BUSCAR_POR_DOCUMENTO) throw new NotImplementedError('ClienteRepository.buscarPorDocumento');
    const rows = await firebirdQuery(QUERY_BUSCAR_POR_DOCUMENTO, [documento.replace(/\D/g, '')]);
    return rows[0] ? mapRowToCliente(rows[0]) : null;
  }

  async buscar(query: SearchQuery): Promise<PaginatedResult<Cliente>> {
    if (!QUERY_BUSCAR_PAGINADO || !QUERY_CONTAR_TOTAL) throw new NotImplementedError('ClienteRepository.buscar');
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const nomeLike = query.descricao ? toLatin1SearchParam(query.descricao) : null;
    const pessoa = query.tipoPessoa ? (query.tipoPessoa === 'PF' ? 1 : 0) : null;
    const uf = query.uf ? query.uf.toUpperCase() : null;

    // Buffer latin1 (não string JS) nos três — comparação contra UPPER()/coluna sem CAST ainda assim
    // não bate de forma confiável com string comum enviada em UTF-8 pelo driver (ver plate-mask bug).
    const buscaFlag = query.busca ? query.busca.trim() : null;
    const buscaDigits = buscaFlag ? buscaFlag.replace(/\D/g, '') : '';
    const buscaCodigoLike = buscaFlag ? Buffer.from(`%${buscaFlag.toUpperCase().replace(/[^A-Z0-9]/g, '')}%`, 'latin1') : null;
    const buscaNomeLike = buscaFlag ? toLatin1SearchParam(buscaFlag) : null;
    // Termo sem nenhum dígito (ex. "CRISTIANO") não pode virar "%%" — isso bateria com qualquer
    // documento/telefone (até vazio) e faria a busca "achar tudo" por engano.
    const buscaDocTelLike = buscaFlag ? Buffer.from(buscaDigits ? `%${buscaDigits}%` : '￿', 'latin1') : null;
    const buscaParams = [
      buscaFlag,
      buscaCodigoLike,
      buscaNomeLike,
      buscaNomeLike,
      buscaDocTelLike,
      buscaDocTelLike,
      buscaDocTelLike,
    ];

    const orderBy = buildOrderBy(query.sortBy, query.sortOrder);
    const queryPaginada = `${QUERY_BUSCAR_PAGINADO} ORDER BY ${orderBy}`;

    const [rows, countRows] = await Promise.all([
      firebirdQuery(queryPaginada, [limit, skip, query.codigo ?? null, nomeLike, nomeLike, pessoa, pessoa, uf, uf, ...buscaParams]),
      firebirdQuery<{ TOTAL: number }>(QUERY_CONTAR_TOTAL, [query.codigo ?? null, nomeLike, nomeLike, pessoa, pessoa, uf, uf, ...buscaParams]),
    ]);

    return { items: rows.map(mapRowToCliente), page, limit, total: Number(countRows[0]?.TOTAL ?? 0) };
  }

  async criar(input: ClienteInput): Promise<Cliente> {
    const chaveCidade = await resolveChaveCidade(input.cidade, input.uf);
    const pessoa = input.tipoPessoa === 'PF' ? 1 : 0;

    const codigo = await firebirdTransaction(async (query) => {
      const gen = await query<{ PROXIMO: number }>(`SELECT GEN_ID(GEN_CLIFOR_ID, 1) AS PROXIMO FROM RDB$DATABASE`);
      const chave = gen[0]?.PROXIMO;
      if (chave === undefined) throw new ExternalServiceError();
      const codigoGerado = String(chave).padStart(6, '0');

      await query(
        `INSERT INTO CLIFOR (
           CHAVE, ATIVO, STATUS, CHAVEEMPRESA, CODIGO, CLIENTE, PESSOA, RAZAOSOCIAL, FANTASIA, CNPJCPF,
           IERG, INSCRICAOMUNICIPAL, REDUCAOMVA, REPRCORE,
           ENDERECO, NUMERO, BAIRRO, COMPLEMENTO, CHAVECIDADE, CEP, CELULAR, TELEFONE,
           EMAIL, EMAILFINANCEIRO, EMAILNFECTE, HOMEPAGE,
           FORNECEDOR, TRANSPORTADOR, REPRESENTANTE, REGIMETRIBUTARIO, CHAVEUSUARIOCAD
         ) VALUES (?, 1, ?, ?, ?, 'S', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          chave,
          input.ativo === false ? 1 : 0,
          CHAVE_EMPRESA,
          codigoGerado,
          pessoa,
          toLatin1Param(input.nome),
          input.nomeFantasia ? toLatin1Param(input.nomeFantasia) : null,
          input.documento,
          input.inscricaoEstadual ?? null,
          input.inscricaoMunicipal ?? null,
          input.reducaoMva ?? null,
          input.coreRepresentante ?? null,
          input.endereco ? toLatin1Param(input.endereco) : null,
          input.numero ?? null,
          input.bairro ? toLatin1Param(input.bairro) : null,
          input.complemento ? toLatin1Param(input.complemento) : null,
          chaveCidade,
          input.cep ?? null,
          input.celular ?? null,
          input.telefone ?? null,
          input.email || null,
          input.emailFinanceiro || null,
          input.emailNfe || null,
          input.homePage || null,
          paraSN(input.fornecedor),
          paraSN(input.transportador),
          paraSN(input.representante),
          input.regimeTributario ?? null,
          input.cherpUsuarioChave ?? env.FIREBIRD_OS_USUARIO_CHAVE,
        ],
      );
      return codigoGerado;
    });

    const criado = await this.buscarPorCodigo(codigo);
    if (!criado) throw new NotFoundError('Cliente criado não pôde ser recarregado.', 'CLIENTE_NOT_FOUND');
    return criado;
  }

  async atualizar(codigo: string, input: ClienteInput): Promise<Cliente> {
    const existente = await this.buscarPorCodigo(codigo);
    if (!existente) throw new NotFoundError('Cliente não encontrado.', 'CLIENTE_NOT_FOUND');

    const chaveCidade = await resolveChaveCidade(input.cidade, input.uf);
    const pessoa = input.tipoPessoa === 'PF' ? 1 : 0;

    await firebirdQuery(
      `UPDATE CLIFOR SET
         ATIVO = 1, STATUS = ?, PESSOA = ?, RAZAOSOCIAL = ?, FANTASIA = ?, CNPJCPF = ?,
         IERG = ?, INSCRICAOMUNICIPAL = ?, REDUCAOMVA = ?, REPRCORE = ?,
         ENDERECO = ?, NUMERO = ?, BAIRRO = ?, COMPLEMENTO = ?, CHAVECIDADE = ?, CEP = ?, CELULAR = ?,
         TELEFONE = ?, EMAIL = ?, EMAILFINANCEIRO = ?, EMAILNFECTE = ?, HOMEPAGE = ?,
         FORNECEDOR = ?, TRANSPORTADOR = ?, REPRESENTANTE = ?, REGIMETRIBUTARIO = ?
       WHERE CODIGO = ? AND CLIENTE = 'S'`,
      [
        input.ativo === false ? 1 : 0,
        pessoa,
        toLatin1Param(input.nome),
        input.nomeFantasia ? toLatin1Param(input.nomeFantasia) : null,
        input.documento,
        input.inscricaoEstadual ?? null,
        input.inscricaoMunicipal ?? null,
        input.reducaoMva ?? null,
        input.coreRepresentante ?? null,
        input.endereco ? toLatin1Param(input.endereco) : null,
        input.numero ?? null,
        input.bairro ? toLatin1Param(input.bairro) : null,
        input.complemento ? toLatin1Param(input.complemento) : null,
        chaveCidade,
        input.cep ?? null,
        input.celular ?? null,
        input.telefone ?? null,
        input.email || null,
        input.emailFinanceiro || null,
        input.emailNfe || null,
        input.homePage || null,
        paraSN(input.fornecedor),
        paraSN(input.transportador),
        paraSN(input.representante),
        input.regimeTributario ?? null,
        codigo,
      ],
    );

    const atualizado = await this.buscarPorCodigo(codigo);
    if (!atualizado) throw new NotFoundError('Cliente não encontrado.', 'CLIENTE_NOT_FOUND');
    return atualizado;
  }
}
