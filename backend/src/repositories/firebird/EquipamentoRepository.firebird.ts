import { toLatin1Param, toLatin1SearchParam } from '../../database/firebird/encoding.js';
import { firebirdQuery, firebirdTransaction } from '../../database/firebird/pool.js';
import { ExternalServiceError } from '../../errors/ExternalServiceError.js';
import { NotFoundError } from '../../errors/NotFoundError.js';
import { NotImplementedError } from '../../errors/NotImplementedError.js';
import { ValidationError } from '../../errors/ValidationError.js';
import type { Equipamento, EquipamentoInput, PaginatedResult, SearchQuery, VinculosCadastro } from '../../types/cherp.types.js';
import type { IEquipamentoRepository } from '../interfaces/IEquipamentoRepository.js';
import { condicaoSemVinculos, contarVinculosTabelas, ORIGENS_VEICULO, vinculosVazios } from './vinculosCadastro.js';

/**
 * Ver ProdutoRepository.firebird.ts para o padrão geral e para a explicação do
 * charset. CLIENTE_CODIGO vem do JOIN com CLIFOR (o código público do cliente,
 * não a chave interna CHAVECLIFOR). CHERP não tem coluna própria de "modelo" —
 * MARCA é campo dedicado, MODELO entra concatenado em DESCRICAO (ver criar()).
 */

const CHAVE_EMPRESA = 1;

const EQUIPAMENTO_SELECT = `
  E.CODIGO AS CODIGO,
  CAST(E.DESCRICAO AS VARCHAR(100) CHARACTER SET OCTETS) AS DESCRICAO,
  C.CODIGO AS CLIENTE_CODIGO,
  CAST(COALESCE(NULLIF(TRIM(C.FANTASIA), ''), C.RAZAOSOCIAL) AS VARCHAR(100) CHARACTER SET OCTETS) AS CLIENTE_NOME,
  CAST(E.IDENTIFICACAO AS VARCHAR(100) CHARACTER SET OCTETS) AS IDENTIFICACAO,
  CAST(E.MARCA AS VARCHAR(100) CHARACTER SET OCTETS) AS MARCA,
  E.ANOFAB AS ANOFAB,
  E.ANOMOD AS ANOMOD,
  CAST(E.CORPREDOMINANTE AS VARCHAR(100) CHARACTER SET OCTETS) AS COR,
  E.CHASSI AS CHASSI
FROM EQUIPAMENTOS E
LEFT JOIN CLIFOR C ON C.CHAVE = E.CHAVECLIFOR`;

const QUERY_BUSCAR_POR_CODIGO: string | null = `
  SELECT ${EQUIPAMENTO_SELECT}
  WHERE E.ATIVO = 1 AND E.CODIGO = ?
`;

const QUERY_BUSCAR_POR_CLIENTE: string | null = `
  SELECT ${EQUIPAMENTO_SELECT}
  WHERE E.ATIVO = 1 AND C.CODIGO = ?
`;

// Placa sempre grava com hífen (ver normalizarPlaca) — comparar sem hífen dos dois lados evita
// falso-negativo se algum registro antigo tiver sido gravado sem a normalização.
const QUERY_BUSCAR_POR_PLACA: string | null = `
  SELECT ${EQUIPAMENTO_SELECT}
  WHERE E.ATIVO = 1 AND REPLACE(UPPER(E.IDENTIFICACAO), '-', '') = ?
`;

const QUERY_BUSCAR_POR_CHASSI: string | null = `
  SELECT ${EQUIPAMENTO_SELECT}
  WHERE E.ATIVO = 1 AND UPPER(E.CHASSI) = ?
`;

// Parâmetros nesta ordem: limit, skip, clienteCodigo|null, codigo|null, anoFabricacao|null x2, descricaoLike|null x2.
// O termo livre compara DESCRICAO (marca+modelo) E IDENTIFICACAO (placa) — antes só batia em DESCRICAO,
// então buscar por placa falhava silenciosamente pra qualquer veículo com marca/modelo preenchido.
// IDENTIFICACAO compara sem hífen dos dois lados (REPLACE) — placa sempre grava com hífen
// (ver normalizarPlaca), mas quem digita na busca não necessariamente inclui o hífen.
const QUERY_BUSCAR_PAGINADO: string | null = `
  SELECT FIRST ? SKIP ? ${EQUIPAMENTO_SELECT}
  WHERE E.ATIVO = 1
    AND COALESCE(C.CODIGO, '') = COALESCE(?, C.CODIGO, '')
    AND E.CODIGO = COALESCE(?, E.CODIGO)
    AND (? IS NULL OR E.ANOFAB = ?)
    AND (
      UPPER(E.DESCRICAO) LIKE COALESCE(?, CAST('%' AS VARCHAR(100) CHARACTER SET OCTETS))
      OR REPLACE(UPPER(E.IDENTIFICACAO), '-', '') LIKE COALESCE(?, CAST('%' AS VARCHAR(20) CHARACTER SET OCTETS))
    )
`;

const ORDEM_POR_SORT_BY: Record<string, string> = {
  codigo: 'E.CODIGO',
  identificacao: 'E.IDENTIFICACAO',
  descricao: 'E.DESCRICAO',
  ano: 'E.ANOFAB',
  cliente: "COALESCE(NULLIF(TRIM(C.FANTASIA), ''), C.RAZAOSOCIAL)",
};

function buildOrderBy(sortBy?: string, sortOrder?: string): string {
  const coluna = ORDEM_POR_SORT_BY[sortBy ?? ''] ?? 'E.DESCRICAO';
  const direcao = sortOrder === 'desc' ? 'DESC' : 'ASC';
  return `${coluna} ${direcao}${sortBy === 'ano' ? `, E.ANOMOD ${direcao}` : ''}, E.CODIGO ASC`;
}

const QUERY_CONTAR_TOTAL: string | null = `
  SELECT COUNT(*) AS TOTAL
  FROM EQUIPAMENTOS E
  LEFT JOIN CLIFOR C ON C.CHAVE = E.CHAVECLIFOR
  WHERE E.ATIVO = 1
    AND COALESCE(C.CODIGO, '') = COALESCE(?, C.CODIGO, '')
    AND E.CODIGO = COALESCE(?, E.CODIGO)
    AND (? IS NULL OR E.ANOFAB = ?)
    AND (
      UPPER(E.DESCRICAO) LIKE COALESCE(?, CAST('%' AS VARCHAR(100) CHARACTER SET OCTETS))
      OR REPLACE(UPPER(E.IDENTIFICACAO), '-', '') LIKE COALESCE(?, CAST('%' AS VARCHAR(20) CHARACTER SET OCTETS))
    )
`;

function mapRowToEquipamento(row: Record<string, unknown>): Equipamento {
  return {
    codigo: String(row.CODIGO ?? row.codigo),
    descricao: String(row.DESCRICAO ?? row.descricao),
    clienteCodigo: String(row.CLIENTE_CODIGO ?? row.clienteCodigo ?? ''),
    clienteNome: row.CLIENTE_NOME ? String(row.CLIENTE_NOME) : undefined,
    identificacao: row.IDENTIFICACAO ? String(row.IDENTIFICACAO) : undefined,
    marca: row.MARCA ? String(row.MARCA) : undefined,
    anoFabricacao: row.ANOFAB ? String(row.ANOFAB) : undefined,
    anoModelo: row.ANOMOD ? String(row.ANOMOD) : undefined,
    cor: row.COR ? String(row.COR) : undefined,
    chassi: row.CHASSI ? String(row.CHASSI) : undefined,
  };
}

function montarDescricao(input: EquipamentoInput): string {
  return [input.marca, input.modelo].filter((s) => s && s.trim()).join(' ') || input.placa;
}

/**
 * O CHERP sempre grava a placa com hífen após o 3º caractere (confirmado contra dado real:
 * "AAA-1111" formato antigo E "MAH-8J8J" Mercosul — o hífen entra nos dois, sempre na mesma
 * posição). A máscara de placa da tela deles espera esse formato; sem o hífen ela quebra e não
 * preenche o cliente vinculado. Nosso formulário mandava a placa crua (ex. "JAL6C24") — normaliza
 * aqui pra bater com a convenção real do sistema, nunca inventada.
 */
function normalizarPlaca(placa: string): string {
  const limpa = placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (limpa.length !== 7) return limpa; // fora do padrão de 7 caracteres — grava como veio, não força
  return `${limpa.slice(0, 3)}-${limpa.slice(3)}`;
}

async function resolveChaveCliente(clienteCodigo: string): Promise<number> {
  const rows = await firebirdQuery<{ CHAVE: number }>(`SELECT CHAVE FROM CLIFOR WHERE CODIGO = ? AND ATIVO = 1`, [
    clienteCodigo,
  ]);
  const row = rows[0];
  if (!row) throw new ValidationError(`Cliente com código "${clienteCodigo}" não encontrado.`);
  return row.CHAVE;
}

export class EquipamentoRepositoryFirebird implements IEquipamentoRepository {
  async buscarPorCodigo(codigo: string): Promise<Equipamento | null> {
    if (!QUERY_BUSCAR_POR_CODIGO) throw new NotImplementedError('EquipamentoRepository.buscarPorCodigo');
    const rows = await firebirdQuery(QUERY_BUSCAR_POR_CODIGO, [codigo]);
    return rows[0] ? mapRowToEquipamento(rows[0]) : null;
  }

  async buscarPorPlaca(placa: string): Promise<Equipamento | null> {
    if (!QUERY_BUSCAR_POR_PLACA) throw new NotImplementedError('EquipamentoRepository.buscarPorPlaca');
    const placaLimpa = toLatin1Param(placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''));
    const rows = await firebirdQuery(QUERY_BUSCAR_POR_PLACA, [placaLimpa]);
    return rows[0] ? mapRowToEquipamento(rows[0]) : null;
  }

  async buscarPorChassi(chassi: string): Promise<Equipamento | null> {
    if (!QUERY_BUSCAR_POR_CHASSI) throw new NotImplementedError('EquipamentoRepository.buscarPorChassi');
    const chassiLimpo = chassi.trim().toUpperCase();
    if (!chassiLimpo) return null;
    const rows = await firebirdQuery(QUERY_BUSCAR_POR_CHASSI, [chassiLimpo]);
    return rows[0] ? mapRowToEquipamento(rows[0]) : null;
  }

  async buscarPorCliente(clienteCodigo: string): Promise<Equipamento[]> {
    if (!QUERY_BUSCAR_POR_CLIENTE) throw new NotImplementedError('EquipamentoRepository.buscarPorCliente');
    const rows = await firebirdQuery(QUERY_BUSCAR_POR_CLIENTE, [clienteCodigo]);
    return rows.map(mapRowToEquipamento);
  }

  async buscar(query: SearchQuery): Promise<PaginatedResult<Equipamento>> {
    if (!QUERY_BUSCAR_PAGINADO || !QUERY_CONTAR_TOTAL) throw new NotImplementedError('EquipamentoRepository.buscar');
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const descricaoLike = query.descricao ? toLatin1SearchParam(query.descricao) : null;
    // Precisa ir como Buffer latin1 (não string JS), igual descricaoLike — comparação é contra uma
    // expressão CHARACTER SET OCTETS (REPLACE/CAST sobre IDENTIFICACAO), que não casa com string comum.
    const placaLike = query.descricao ? toLatin1SearchParam(query.descricao.replace(/[^A-Za-z0-9]/g, '')) : null;
    const filtros = [query.clienteCodigo ?? null, query.codigo ?? null, query.anoFabricacao ?? null, query.anoFabricacao ?? null, descricaoLike, placaLike];

    const [rows, countRows] = await Promise.all([
      firebirdQuery(`${QUERY_BUSCAR_PAGINADO} ORDER BY ${buildOrderBy(query.sortBy, query.sortOrder)}`, [limit, skip, ...filtros]),
      firebirdQuery<{ TOTAL: number }>(QUERY_CONTAR_TOTAL, filtros),
    ]);

    return { items: rows.map(mapRowToEquipamento), page, limit, total: Number(countRows[0]?.TOTAL ?? 0) };
  }

  async criar(input: EquipamentoInput): Promise<Equipamento> {
    const chaveCliente = await resolveChaveCliente(input.clienteCodigo);
    const descricao = montarDescricao(input);

    const codigo = await firebirdTransaction(async (query) => {
      const gen = await query<{ PROXIMO: number }>(`SELECT GEN_ID(GEN_EQUIPAMENTOS_ID, 1) AS PROXIMO FROM RDB$DATABASE`);
      const chave = gen[0]?.PROXIMO;
      if (chave === undefined) throw new ExternalServiceError();
      const codigoGerado = String(chave).padStart(6, '0');

      await query(
        `INSERT INTO EQUIPAMENTOS (
           CHAVE, CHAVEEMPRESA, CODIGO, CHAVECLIFOR, DESCRICAO, IDENTIFICACAO, MARCA, ANOFAB, ANOMOD, CORPREDOMINANTE, CHASSI
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          chave,
          CHAVE_EMPRESA,
          codigoGerado,
          chaveCliente,
          toLatin1Param(descricao),
          normalizarPlaca(input.placa),
          input.marca ? toLatin1Param(input.marca) : null,
          input.anoFabricacao ?? null,
          input.anoModelo ?? null,
          input.cor ? toLatin1Param(input.cor) : null,
          input.chassi ?? null,
        ],
      );
      return codigoGerado;
    });

    const criado = await this.buscarPorCodigo(codigo);
    if (!criado) throw new NotFoundError('Veículo criado não pôde ser recarregado.', 'EQUIPAMENTO_NOT_FOUND');
    return criado;
  }

  async atualizar(codigo: string, input: EquipamentoInput): Promise<Equipamento> {
    const existente = await this.buscarPorCodigo(codigo);
    if (!existente) throw new NotFoundError('Veículo não encontrado.', 'EQUIPAMENTO_NOT_FOUND');

    const chaveCliente = await resolveChaveCliente(input.clienteCodigo);
    const descricao = montarDescricao(input);

    await firebirdQuery(
      `UPDATE EQUIPAMENTOS SET
         CHAVECLIFOR = ?, DESCRICAO = ?, IDENTIFICACAO = ?, MARCA = ?, ANOFAB = ?, ANOMOD = ?, CORPREDOMINANTE = ?, CHASSI = ?
       WHERE CODIGO = ? AND ATIVO = 1`,
      [
        chaveCliente,
        toLatin1Param(descricao),
        normalizarPlaca(input.placa),
        input.marca ? toLatin1Param(input.marca) : null,
        input.anoFabricacao ?? null,
        input.anoModelo ?? null,
        input.cor ? toLatin1Param(input.cor) : null,
        input.chassi ?? null,
        codigo,
      ],
    );

    const atualizado = await this.buscarPorCodigo(codigo);
    if (!atualizado) throw new NotFoundError('Veículo não encontrado.', 'EQUIPAMENTO_NOT_FOUND');
    return atualizado;
  }

  async excluir(codigo: string): Promise<boolean> {
    await firebirdQuery(
      `UPDATE EQUIPAMENTOS E SET ATIVO = 0
       WHERE E.CODIGO = ? AND E.ATIVO = 1
         AND ${condicaoSemVinculos(ORIGENS_VEICULO, 'E')}`,
      [codigo],
    );
    const rows = await firebirdQuery<{ ATIVO: number }>(`SELECT ATIVO FROM EQUIPAMENTOS WHERE CODIGO = ?`, [codigo]);
    return rows.length > 0 && Number(rows[0]!.ATIVO) === 0;
  }

  async contarVinculos(codigo: string): Promise<VinculosCadastro> {
    const rows = await firebirdQuery<{ CHAVE: number }>(`SELECT CHAVE FROM EQUIPAMENTOS WHERE CODIGO = ? AND ATIVO = 1`, [codigo]);
    if (!rows[0]) return vinculosVazios();
    return contarVinculosTabelas(ORIGENS_VEICULO, rows[0].CHAVE);
  }
}
