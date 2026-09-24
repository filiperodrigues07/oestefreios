import { eq, inArray } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db } from '../../database/postgres/client.js';
import { osWorkflow } from '../../database/postgres/schema.js';
import { toLatin1Param, toLatin1SearchParam } from '../../database/firebird/encoding.js';
import { firebirdQuery, firebirdQueryWithBlob, firebirdTransaction } from '../../database/firebird/pool.js';
import { ExternalServiceError } from '../../errors/ExternalServiceError.js';
import { NotFoundError } from '../../errors/NotFoundError.js';
import { ValidationError } from '../../errors/ValidationError.js';
import { logger } from '../../utils/logger.js';
import type {
  OrdemServico,
  OSHistoricoEntry,
  OSItemProduto,
  OSItemServico,
  OSPrioridade,
  OSStatus,
} from '../../types/cherp.types.js';
import type {
  IOSRepository,
  OSDashboardFilter,
  OSImagemArquivo,
  OSImagemMeta,
  OSImagemNova,
  OSItemPatch,
  OSListFilter,
  OSReportFilter,
} from '../interfaces/IOSRepository.js';

/**
 * Implementação real contra o Firebird/CHERP (schema Questor).
 *
 * A OS "de verdade" — cabeçalho, itens, totais — mora em ORDEMSERVICO +
 * ITENSORDEMSERVICOPROD/SERV, igual a uma OS aberta direto no CHERP. Mas o
 * CHERP não tem campo para o workflow mais granular do nosso app (7 status
 * contra o ABERTO/FECHADO dele, prioridade, histórico de eventos, responsável/
 * técnico — usuários nossos, sem cadastro lá). Isso mora em `os_workflow`
 * (Postgres), ligado por `id` = ORDEMSERVICO.IDENTIFICADOR (UUID gerado pelo
 * próprio CHERP na trigger ORDEMSERVICO_BI).
 *
 * Uma OS criada direto no CHERP (sem passar pelo app) não tem linha em
 * `os_workflow` — a leitura já lida com isso (status/prioridade inferidos a
 * partir de SITUACAO, histórico sintético). A linha só é criada de fato na
 * primeira escrita feita pelo app (`atualizar`), nunca numa leitura.
 *
 * `CHAVEUSUARIOINICIOU`/`CHAVEUSUARIOFECHOU` sempre gravam o usuário fixo de
 * integração (`FIREBIRD_OS_USUARIO_CHAVE`) — decisão registrada no README,
 * não um mapeamento por usuário do app.
 */

const CHAVE_EMPRESA = 1;
const CHAVE_TABELA_PRECO = 1;
const SITUACAO_ABERTO = 0;
const SITUACAO_ESTORNADA = 6;

/** Grupo da tabela genérica TABELAS (Fase OS-0) com a "situação de atendimento" do CHERP. */
const CHAVETABELA_SITUACAO_ATENDIMENTO = 15;

/**
 * Espelho só-escrita dos 5 status intermediários pro campo nativo CHAVESITUACAOOS do CHERP —
 * puramente informativo pra quem olha a OS direto no CHERP. CONCLUIDA e CANCELADA ficam de fora de
 * propósito: são decisão só do nosso app (`os_workflow.travado_local`, ver `atualizar` abaixo) e
 * nunca escrevem nada no CHERP, pro time de faturamento continuar processando por lá.
 */
const SITUACAO_ATENDIMENTO_CODIGO_POR_STATUS: Partial<Record<OSStatus, string>> = {
  ABERTA: '000001', // EM ATENDIMENTO
  EM_ANALISE: '000001', // EM ATENDIMENTO
  EM_ANDAMENTO: '000001', // EM ATENDIMENTO
  AGUARDANDO_CLIENTE: '000002', // AGUARDANDO RET. CLIENTE
  AGUARDANDO_PECA: '000003', // AGUARDANDO PEÇAS
};

/**
 * Espelho só-escrita da nossa prioridade (4 valores) pro campo nativo ORDEMSERVICO.PRIORIDADE —
 * inteiro simples, não é FK pra TABELAS. Escala confirmada pelo usuário (mesma usada em outro
 * projeto dele sobre o mesmo schema Questor/CHERP): 0=NORMAL, 1=BAIXA, 2=MEDIA, 3=ALTA. O CHERP não
 * tem um nível "urgente" — URGENTE cai em ALTA (o mais alto que existe lá), igual não-lido-de-volta.
 */
const PRIORIDADE_CODIGO_POR_STATUS: Record<OSPrioridade, number> = {
  NORMAL: 0,
  BAIXA: 1,
  MEDIA: 2,
  ALTA: 3,
  URGENTE: 3,
};

const OBS_MARK = '[OBSERVACOES]\n';
const SOLUCAO_MARK = '\n[SOLUCAO]\n';

function encodeObs(observacoes?: string, solucao?: string): Buffer | null {
  if (!observacoes && !solucao) return null;
  return toLatin1Param(`${OBS_MARK}${observacoes ?? ''}${SOLUCAO_MARK}${solucao ?? ''}`);
}

function decodeObs(raw: unknown): { observacoes?: string; solucao?: string } {
  const texto = raw == null ? '' : String(raw);
  if (!texto) return {};
  const solIdx = texto.indexOf(SOLUCAO_MARK);
  if (solIdx === -1) return { observacoes: texto || undefined };
  const observacoes = texto.slice(OBS_MARK.length, solIdx) || undefined;
  const solucao = texto.slice(solIdx + SOLUCAO_MARK.length) || undefined;
  return { observacoes, solucao };
}

/**
 * "Finalizar OS" (status CONCLUIDA/CANCELADA) é decisão só do nosso app, marcada em
 * `os_workflow.travado_local` — nunca escreve nada no CHERP de propósito, pro time de faturamento
 * continuar processando por lá (ver `assertNaoFinalizada` em os.service.ts, que bloqueia edição
 * posterior só do nosso lado). Sem esse flag, o status exibido é sempre derivado do CHERP.
 *
 * CHAVESITUACAOOS (situação de atendimento) sozinha não é sinal confiável de conclusão: PRONTA
 * (000004) é só o mecânico dizendo que terminou, nada fiscal aconteceu ainda; e ENCERRADA (000006)
 * é setada automaticamente pelo CHERP tanto quando gera pedido/NF (conclusão de verdade) quanto,
 * antes disso, só por outros motivos internos do atendimento — não dá pra distinguir só por ela.
 * Por isso conclusão/cancelamento aqui são decididos pela SITUACAO fiscal (documento) e pela data
 * nativa de fechamento, nunca pela situação de atendimento.
 */
/** Sem sinal fiscal de encerramento, o único indício confiável é a data nativa de fechamento. */
function statusFromSituacaoOnly(dataFechamento: unknown): OSStatus {
  return dataFechamento != null ? 'CONCLUIDA' : 'ABERTA';
}

/** Situação fiscal (documento) manda no status exibido; atendimento só cobre os estados intermediários. */
function statusFromCherpSituacao(codigo: string | null, dataFechamento: unknown, situacaoDocumento: number): OSStatus {
  if (situacaoDocumento === SITUACAO_ESTORNADA) return 'CANCELADA';
  if (situacaoDocumento !== SITUACAO_ABERTO) return 'CONCLUIDA'; // pedido/NF gerado no CHERP: faturado de verdade
  switch (codigo?.trim()) {
    case '000001': return 'ABERTA';
    case '000002': return 'AGUARDANDO_CLIENTE';
    case '000003': return 'AGUARDANDO_PECA';
    default: return statusFromSituacaoOnly(dataFechamento);
  }
}

/** Escala nativa do CHERP: 0 Normal, 1 Baixa, 2 Média e 3 Alta. */
function prioridadeFromCherp(valor: number | null): OSPrioridade {
  switch (valor) {
    case 1: return 'BAIXA';
    case 2: return 'MEDIA';
    case 3: return 'ALTA';
    default: return 'NORMAL';
  }
}

function combineDateTime(date: unknown, time: unknown): string {
  const d = date instanceof Date ? date : new Date(String(date));
  const t = time instanceof Date ? time : new Date(String(time));
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  const combined = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number.isNaN(t.getTime()) ? 0 : t.getHours(), Number.isNaN(t.getTime()) ? 0 : t.getMinutes(), Number.isNaN(t.getTime()) ? 0 : t.getSeconds());
  return combined.toISOString();
}

interface OSHeaderRow {
  CHAVE: number;
  IDENTIFICADOR: string;
  ORDEM: string;
  CLIENTE_CODIGO: string | null;
  CLIENTE_NOME: string | null;
  EQUIPAMENTO_CODIGO: string | null;
  EQUIPAMENTO_DESCRICAO: string | null;
  PROBLEMA: string | null;
  DIAGNOSTICO: string | null;
  OBS: string | null;
  SITUACAO: number;
  SITUACAO_ATENDIMENTO_CODIGO: string | null;
  PRIORIDADE: number | null;
  DATA: unknown;
  HORAABERTURA: unknown;
  DATAFECHA: unknown;
  HORAFECHAMENTO: unknown;
  TOTALPRODUTO: number | null;
  TOTALSERVICO: number | null;
  TOTALOS: number | null;
  NRODAV: string | null;
  KMATUAL: number | null;
  KMFINAL: number | null;
  FRETE: number | null;
  TOTALIPI: number | null;
}

const HEADER_SELECT = `
  SELECT
    OS.CHAVE AS CHAVE,
    OS.IDENTIFICADOR AS IDENTIFICADOR,
    OS.ORDEM AS ORDEM,
    CLI.CODIGO AS CLIENTE_CODIGO,
    CAST(COALESCE(NULLIF(TRIM(CLI.FANTASIA), ''), CLI.RAZAOSOCIAL) AS VARCHAR(100) CHARACTER SET OCTETS) AS CLIENTE_NOME,
    EQ.CODIGO AS EQUIPAMENTO_CODIGO,
    CAST(COALESCE(NULLIF(TRIM(EQ.IDENTIFICACAO), ''), EQ.DESCRICAO) AS VARCHAR(100) CHARACTER SET OCTETS) AS EQUIPAMENTO_DESCRICAO,
    CAST(OS.PROBLEMAABERTURAOS AS VARCHAR(5000) CHARACTER SET OCTETS) AS PROBLEMA,
    CAST(OS.LAUDOTECNICO AS VARCHAR(5000) CHARACTER SET OCTETS) AS DIAGNOSTICO,
    CAST(OS.OBS AS VARCHAR(5000) CHARACTER SET OCTETS) AS OBS,
    OS.SITUACAO AS SITUACAO,
    SIT.CODIGO AS SITUACAO_ATENDIMENTO_CODIGO,
    OS.PRIORIDADE AS PRIORIDADE,
    OS.DATA AS DATA,
    OS.HORAABERTURA AS HORAABERTURA,
    OS.DATAFECHA AS DATAFECHA,
    OS.HORAFECHAMENTO AS HORAFECHAMENTO,
    OS.TOTALPRODUTO AS TOTALPRODUTO,
    OS.TOTALSERVICO AS TOTALSERVICO,
    OS.TOTALOS AS TOTALOS,
    OS.NRODAV AS NRODAV,
    OS.KMATUAL AS KMATUAL,
    OS.KMFINAL AS KMFINAL,
    OS.FRETE AS FRETE,
    OS.TOTALIPI AS TOTALIPI
  FROM ORDEMSERVICO OS
  LEFT JOIN CLIFOR CLI ON CLI.CHAVE = OS.CHAVECLIFOR
  LEFT JOIN EQUIPAMENTOS EQ ON EQ.CHAVE = OS.CHAVEEQUIPAMENTO
  LEFT JOIN TABELAS SIT ON SIT.CHAVE = OS.CHAVESITUACAOOS AND SIT.CHAVETABELA = 15
  WHERE OS.ATIVO = 1
`;

interface ItemProdutoRow {
  CHAVE: number;
  CHAVEOS: number;
  CODIGO: string;
  DESCRICAO: string;
  UNIDADE: string;
  QTDE: number;
  VLRUNIT: number | null;
  DESCVLR: number | null;
  VLRTOTAL: number | null;
  DESCRCOMPLEMENT: string | null;
}

interface ItemServicoRow {
  CHAVE: number;
  CHAVEOS: number;
  CODIGO: string;
  DESCRICAO: string;
  UNIDADE: string;
  QTDE: number;
  VLRUNIT: number | null;
  DESCVLR: number | null;
  VLRTOTAL: number | null;
  DESCRCOMPLEMENT: string | null;
}

const ITEM_PRODUTO_SELECT = `
  SELECT CHAVE AS CHAVE, CHAVEOS AS CHAVEOS, CODPRODUTO AS CODIGO, CAST(PRODUTO AS VARCHAR(100) CHARACTER SET OCTETS) AS DESCRICAO,
         UN AS UNIDADE, QTDE AS QTDE, VLRUNIT AS VLRUNIT, DESCVLR AS DESCVLR, VLRTOTAL AS VLRTOTAL,
         CAST(DESCRCOMPLEMENT AS VARCHAR(1000) CHARACTER SET OCTETS) AS DESCRCOMPLEMENT
  FROM ITENSORDEMSERVICOPROD
  WHERE CHAVEOS = ? AND ATIVO = 1
  ORDER BY NUMITEM, CHAVE
`;

const ITEM_SERVICO_SELECT = `
  SELECT CHAVE AS CHAVE, CHAVEOS AS CHAVEOS, CODPRODUTO AS CODIGO, CAST(PRODUTO AS VARCHAR(100) CHARACTER SET OCTETS) AS DESCRICAO,
         UN AS UNIDADE, QTDE AS QTDE, VLRUNIT AS VLRUNIT, DESCVLR AS DESCVLR, VLRTOTAL AS VLRTOTAL,
         CAST(DESCRCOMPLEMENT AS VARCHAR(1000) CHARACTER SET OCTETS) AS DESCRCOMPLEMENT
  FROM ITENSORDEMSERVICOSERV
  WHERE CHAVEOS = ? AND ATIVO = 1
  ORDER BY NUMITEM, CHAVE
`;

interface WorkflowRow {
  id: string;
  status: string;
  prioridade: string;
  responsavelId: string | null;
  tecnicoId: string | null;
  dataPrevista: Date | null;
  travadoLocal: boolean;
  historico: unknown;
}

function mapItemProduto(row: ItemProdutoRow): OSItemProduto {
  return {
    produtoCodigo: row.CODIGO,
    descricao: row.DESCRICAO,
    unidade: row.UNIDADE,
    quantidade: Number(row.QTDE),
    precoUnitario: row.VLRUNIT !== null ? Number(row.VLRUNIT) : undefined,
    desconto: row.DESCVLR !== null ? Number(row.DESCVLR) : undefined,
    total: row.VLRTOTAL !== null ? Number(row.VLRTOTAL) : undefined,
    descricaoComplementar: row.DESCRCOMPLEMENT?.trim() || undefined,
  };
}

function mapItemServico(row: ItemServicoRow): OSItemServico {
  return {
    servicoCodigo: row.CODIGO,
    descricao: row.DESCRICAO,
    unidade: row.UNIDADE,
    quantidade: Number(row.QTDE),
    valorUnitario: row.VLRUNIT !== null ? Number(row.VLRUNIT) : undefined,
    desconto: row.DESCVLR !== null ? Number(row.DESCVLR) : undefined,
    total: row.VLRTOTAL !== null ? Number(row.VLRTOTAL) : undefined,
    descricaoComplementar: row.DESCRCOMPLEMENT?.trim() || undefined,
  };
}

function buildOrdemServico(
  header: OSHeaderRow,
  produtos: OSItemProduto[],
  servicos: OSItemServico[],
  workflow: WorkflowRow | undefined,
): OrdemServico {
  const { observacoes, solucao } = decodeObs(header.OBS);
  const dataAbertura = combineDateTime(header.DATA, header.HORAABERTURA);
  const dataConclusao =
    header.DATAFECHA != null ? combineDateTime(header.DATAFECHA, header.HORAFECHAMENTO ?? header.DATAFECHA) : undefined;

  const faturamento =
    header.TOTALPRODUTO === null || header.TOTALSERVICO === null
      ? undefined
      : Number(header.TOTALPRODUTO) + Number(header.TOTALSERVICO);

  return {
    id: header.IDENTIFICADOR,
    numero: Number(header.ORDEM),
    clienteCodigo: header.CLIENTE_CODIGO ?? '',
    clienteNome: header.CLIENTE_NOME ?? undefined,
    equipamentoCodigo: header.EQUIPAMENTO_CODIGO ?? '',
    equipamentoDescricao: header.EQUIPAMENTO_DESCRICAO ?? undefined,
    status: workflow?.travadoLocal
      ? (workflow.status as OSStatus)
      : statusFromCherpSituacao(header.SITUACAO_ATENDIMENTO_CODIGO, header.DATAFECHA, header.SITUACAO),
    prioridade: prioridadeFromCherp(header.PRIORIDADE),
    responsavelId: workflow?.responsavelId ?? undefined,
    tecnicoId: workflow?.tecnicoId ?? undefined,
    problema: header.PROBLEMA ?? '',
    diagnostico: header.DIAGNOSTICO || undefined,
    observacoes,
    solucao,
    produtos,
    servicos,
    historico: workflow
      ? (workflow.historico as OSHistoricoEntry[])
      : [{ timestamp: dataAbertura, evento: 'OS aberta no CHERP', usuarioNome: '(CHERP)' }],
    dataAbertura,
    dataPrevista: workflow?.dataPrevista ? workflow.dataPrevista.toISOString() : undefined,
    dataConclusao,
    situacaoDocumento: header.SITUACAO,
    travadoLocal: workflow?.travadoLocal ?? false,
    faturamento,
    nroDav: header.NRODAV?.trim() || undefined,
    kmAtual: header.KMATUAL !== null ? Number(header.KMATUAL) : undefined,
    kmFinal: header.KMFINAL !== null ? Number(header.KMFINAL) : undefined,
    frete: header.FRETE !== null ? Number(header.FRETE) : undefined,
    totalIpi: header.TOTALIPI !== null ? Number(header.TOTALIPI) : undefined,
  };
}

async function fetchWorkflow(id: string): Promise<WorkflowRow | undefined> {
  const [row] = await db.select().from(osWorkflow).where(eq(osWorkflow.id, id));
  return row as WorkflowRow | undefined;
}

/**
 * Postgres normaliza `uuid` pra minúsculo ao gravar; o CHERP devolve o
 * IDENTIFICADOR em maiúsculo (GEN_UUID()/UUID_TO_CHAR()). SQL compara uuid
 * como valor (case-insensitive), mas um `Map.get()` em JS é comparação de
 * string — por isso a chave do mapa é sempre normalizada aqui.
 */
async function fetchWorkflows(ids: string[]): Promise<Map<string, WorkflowRow>> {
  if (ids.length === 0) return new Map();
  const rows: WorkflowRow[] = [];
  for (let start = 0; start < ids.length; start += 500) {
    const lote = await db.select().from(osWorkflow).where(inArray(osWorkflow.id, ids.slice(start, start + 500)));
    rows.push(...(lote as WorkflowRow[]));
  }
  return new Map(rows.map((r) => [r.id.toLowerCase(), r as WorkflowRow]));
}

async function resolveChaveByCodigo(tabela: 'CLIFOR' | 'EQUIPAMENTOS', codigo: string): Promise<number> {
  const rows = await firebirdQuery<{ CHAVE: number }>(`SELECT CHAVE FROM ${tabela} WHERE CODIGO = ? AND ATIVO = 1`, [codigo]);
  const row = rows[0];
  if (!row) {
    throw new ValidationError(`Registro com código "${codigo}" não encontrado no CHERP (${tabela}).`);
  }
  return row.CHAVE;
}

/**
 * TABELAS é a lista genérica de domínio do CHERP (Fase OS-0) — várias listas não relacionadas
 * (situação de atendimento, situação de entrega, etc.) vivem nessa única tabela, distinguidas por
 * CHAVETABELA. CHAVE é autoincrement por instalação, nunca hardcoded — sempre resolvido em tempo
 * de escrita pelo CODIGO (esse sim estável entre bases).
 */
async function resolveTabelaChave(chaveTabela: number, codigo: string): Promise<number | undefined> {
  const rows = await firebirdQuery<{ CHAVE: number }>(
    `SELECT CHAVE FROM TABELAS WHERE CHAVETABELA = ? AND CODIGO = ? AND ATIVO = 1`,
    [chaveTabela, codigo],
  );
  return rows[0]?.CHAVE;
}

interface PerfilFiscal {
  chave: number;
  chaveCfopProduto: number | null;
  chaveCfopServico: number | null;
}

interface ProdutoParaOS {
  chave: number;
  chaveUnidade: number;
  chaveTributacao: number | null;
  precoCusto: number | null;
  precoVenda: number | null;
  precoVendaMinimo: number | null;
  chaveDptoEstoque: number | null;
  chavePerfilFiscalProduto: number | null;
  chaveCfopProduto: number | null;
}

/** Perfis e CFOPs vêm da configuração desta instalação do CHERP, nunca de constantes da aplicação. */
async function resolvePerfilFiscalPadrao(principalDocumento: 'S' | 'N'): Promise<PerfilFiscal> {
  const rows = await firebirdQuery<{
    CHAVE: number;
    CHAVECFOPPRODDE: number | null;
    CHAVECFOPSERVDE: number | null;
  }>(
    `SELECT FIRST 1 CHAVE, CHAVECFOPPRODDE, CHAVECFOPSERVDE
       FROM CFOPOPERFISCAIS
      WHERE CHAVEEMPRESA = ? AND ATIVO = 1 AND OPERFISCPRINCIPALDOC = ?
      ORDER BY CHAVE`,
    [CHAVE_EMPRESA, principalDocumento],
  );
  const row = rows[0];
  if (!row) throw new ValidationError('Perfil fiscal padrão não encontrado no CHERP.');
  return {
    chave: row.CHAVE,
    chaveCfopProduto: row.CHAVECFOPPRODDE,
    chaveCfopServico: row.CHAVECFOPSERVDE,
  };
}

async function resolveProduto(codigo: string): Promise<ProdutoParaOS> {
  const rows = await firebirdQuery<{
    CHAVE: number;
    CHAVEUNIDADE: number;
    CHAVETRIBUTACAO: number | null;
    PRECOCUSTO: number | null;
    PRECOVENDA: number | null;
    PRECOVENDAMINIMO: number | null;
    CHAVEDPTOESTOQUE: number | null;
    CHAVEPERFILFISCALPRODUTO: number | null;
    CHAVECFOPPRODUTO: number | null;
  }>(
    `SELECT P.CHAVE AS CHAVE, P.CHAVEUNIDADE AS CHAVEUNIDADE,
            GF.CHAVETRIBUTACAO AS CHAVETRIBUTACAO,
            PC.PRECOCUSTO AS PRECOCUSTO,
            PV.PRECOVENDA AS PRECOVENDA, PV.PRECOVENDAMINIMO AS PRECOVENDAMINIMO,
            PDE.CHAVEDPTOESTOQUE AS CHAVEDPTOESTOQUE,
            GF.CHAVECFOPOPERFISCAIS AS CHAVEPERFILFISCALPRODUTO,
            PERFIL.CHAVECFOPPRODDE AS CHAVECFOPPRODUTO
       FROM PRODUTO P
       LEFT JOIN GRUPOFISCAL GF ON GF.CHAVE = P.CHAVEGRUPOFISCAL
       LEFT JOIN PRODUTOCUSTO PC ON PC.CHAVEPRODUTO = P.CHAVE AND PC.CHAVEEMPRESA = ? AND PC.ATIVO = 1
       LEFT JOIN PRODUTOVENDA PV ON PV.CHAVEPRODUTO = P.CHAVE AND PV.CHAVEEMPRESA = ? AND PV.CHAVETABELAPRECO = ? AND PV.ATIVO = 1
       LEFT JOIN PRODUTODPTOESTOQUE PDE ON PDE.CHAVEPRODUTO = P.CHAVE AND PDE.CHAVEEMPRESA = ? AND PDE.ATIVO = 1
       LEFT JOIN CFOPOPERFISCAIS PERFIL ON PERFIL.CHAVE = GF.CHAVECFOPOPERFISCAIS AND PERFIL.ATIVO = 1
      WHERE P.CODIGO = ? AND P.ATIVO = 1`,
    [CHAVE_EMPRESA, CHAVE_EMPRESA, CHAVE_TABELA_PRECO, CHAVE_EMPRESA, codigo],
  );
  const row = rows[0];
  if (!row) {
    throw new ValidationError(`Produto/serviço com código "${codigo}" não encontrado no CHERP.`);
  }
  return {
    chave: row.CHAVE,
    chaveUnidade: row.CHAVEUNIDADE,
    chaveTributacao: row.CHAVETRIBUTACAO,
    precoCusto: row.PRECOCUSTO,
    precoVenda: row.PRECOVENDA,
    precoVendaMinimo: row.PRECOVENDAMINIMO,
    chaveDptoEstoque: row.CHAVEDPTOESTOQUE,
    chavePerfilFiscalProduto: row.CHAVEPERFILFISCALPRODUTO,
    chaveCfopProduto: row.CHAVECFOPPRODUTO,
  };
}

export class OSRepositoryFirebird implements IOSRepository {
  async buscarPorId(id: string): Promise<OrdemServico | null> {
    const headers = await firebirdQuery<OSHeaderRow>(`${HEADER_SELECT} AND OS.IDENTIFICADOR = ?`, [id]);
    const header = headers[0];
    if (!header) return null;

    const [itensProd, itensServ, workflow] = await Promise.all([
      firebirdQuery<ItemProdutoRow>(ITEM_PRODUTO_SELECT, [header.CHAVE]),
      firebirdQuery<ItemServicoRow>(ITEM_SERVICO_SELECT, [header.CHAVE]),
      fetchWorkflow(id),
    ]);

    return buildOrdemServico(header, itensProd.map(mapItemProduto), itensServ.map(mapItemServico), workflow);
  }

  /**
   * Só OS em aberto (SITUACAO = 0 no Firebird) entram na listagem — concluída/cancelada nunca
   * aparecem aqui. Decisão de negócio (não só performance): diferente do histórico total, que só
   * cresce com o tempo e não dá pra buscar inteiro sem paginação de verdade no SQL, o volume de OS
   * em aberto é naturalmente limitado (não acumula ano após ano), então filtrar por SITUACAO no
   * Firebird já é suficiente pra manter a consulta rápida numa base grande de verdade — sem o teto
   * arbitrário de "só as 500 mais recentes" que existia antes (que também escondia OS antigas).
   */
  async listar(filter: OSListFilter): Promise<{ items: OrdemServico[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filter.situacaoDocumento !== undefined) {
      // Filtro explícito de situação do documento tem prioridade — nunca combina com a
      // restrição automática de "incluirFinalizadas", senão as duas condições em OS.SITUACAO
      // se anulam (nenhuma linha satisfaz duas igualdades diferentes ao mesmo tempo).
      conditions.push('OS.SITUACAO = ?');
      params.push(filter.situacaoDocumento);
    } else if (!filter.incluirFinalizadas) {
      conditions.push('OS.SITUACAO = ?');
      params.push(SITUACAO_ABERTO);
    }
    if (filter.clienteCodigo) {
      conditions.push('CLI.CODIGO = ?');
      params.push(filter.clienteCodigo);
    }
    if (filter.dataInicial) {
      conditions.push('OS.DATA >= ?');
      params.push(filter.dataInicial);
    }
    if (filter.dataFinal) {
      conditions.push('OS.DATA <= ?');
      params.push(filter.dataFinal);
    }
    // Prioridade é coluna direta (OS.PRIORIDADE) — dá pra filtrar em SQL, reduz o que precisa
    // vir pra memória antes do filtro de status (ver comentário abaixo sobre por que status não dá).
    if (filter.prioridade && filter.prioridade in PRIORIDADE_CODIGO_POR_STATUS) {
      conditions.push('OS.PRIORIDADE = ?');
      params.push(PRIORIDADE_CODIGO_POR_STATUS[filter.prioridade as OSPrioridade]);
    }
    // Busca livre também vai pra SQL — mesmo padrão de ClienteRepository/EquipamentoRepository
    // (CAST sem OCTETS pra coluna curta, sem CAST nenhum pra RAZAOSOCIAL/FANTASIA/DESCRICAO,
    // REPLACE sem hífen pra placa). Reduz bastante o que precisa vir pra memória numa busca típica.
    const buscaFlag = filter.busca ? filter.busca.trim() : null;
    if (buscaFlag) {
      const buscaCodigoLike = Buffer.from(`%${buscaFlag.toUpperCase().replace(/[^A-Z0-9]/g, '')}%`, 'latin1');
      const buscaTextoLike = toLatin1SearchParam(buscaFlag);
      const buscaPlacaLike = Buffer.from(`%${buscaFlag.toUpperCase().replace(/[^A-Z0-9]/g, '')}%`, 'latin1');
      conditions.push(`(
        UPPER(CAST(OS.ORDEM AS VARCHAR(50))) LIKE ?
        OR UPPER(CAST(CLI.CODIGO AS VARCHAR(50))) LIKE ?
        OR UPPER(CLI.RAZAOSOCIAL) LIKE ?
        OR UPPER(CLI.FANTASIA) LIKE ?
        OR UPPER(CAST(EQ.CODIGO AS VARCHAR(50))) LIKE ?
        OR REPLACE(UPPER(EQ.IDENTIFICACAO), '-', '') LIKE ?
        OR UPPER(EQ.DESCRICAO) LIKE ?
      )`);
      params.push(buscaCodigoLike, buscaCodigoLike, buscaTextoLike, buscaTextoLike, buscaCodigoLike, buscaPlacaLike, buscaTextoLike);
    }
    const candidateSql = `${HEADER_SELECT}${conditions.length ? ` AND ${conditions.join(' AND ')}` : ''} ORDER BY OS.CHAVE DESC`;
    const headers = await firebirdQuery<OSHeaderRow>(candidateSql, params);

    const workflows = await fetchWorkflows(headers.map((h) => h.IDENTIFICADOR));

    // status e tecnicoId NÃO dá pra empurrar pro SQL: status é calculado combinando o atendimento
    // do CHERP com `os_workflow.travado_local` do Postgres (ver buildOrdemServico), e tecnicoId
    // mora só no Postgres (os_workflow) — nenhum dos dois existe como coluna no Firebird pra
    // comparar na mesma query. Continuam filtrados aqui, depois do merge com o workflow.
    let merged = headers.map((h) => buildOrdemServico(h, [], [], workflows.get(h.IDENTIFICADOR.toLowerCase())));
    if (filter.status === 'AGUARDANDO') {
      merged = merged.filter((os) => os.status === 'AGUARDANDO_PECA' || os.status === 'AGUARDANDO_CLIENTE');
    } else if (filter.status) {
      merged = merged.filter((os) => os.status === filter.status);
    }
    if (filter.situacaoDocumento !== undefined) {
      merged = merged.filter((os) => os.situacaoDocumento === filter.situacaoDocumento);
    }
    if (filter.tecnicoId) {
      merged = merged.filter((os) => os.tecnicoId === filter.tecnicoId);
    }

    if (filter.sortBy) {
      const direcao = filter.sortOrder === 'desc' ? -1 : 1;
      const chave = filter.sortBy;
      merged = [...merged].sort((a, b) => {
        const va = a[chave as keyof OrdemServico];
        const vb = b[chave as keyof OrdemServico];
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * direcao;
        return String(va ?? '').localeCompare(String(vb ?? ''), 'pt-BR') * direcao;
      });
    }

    const total = merged.length;
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const start = (page - 1) * limit;
    const pageItems = merged.slice(start, start + limit);

    // Duas consultas agrupadas por página, em vez de duas consultas para cada OS.
    const pageHeaders = pageItems.map((os) => headers.find((header) => header.IDENTIFICADOR === os.id)!);
    const chaves = pageHeaders.map((header) => header.CHAVE);
    let itensProd: ItemProdutoRow[] = [];
    let itensServ: ItemServicoRow[] = [];
    if (chaves.length > 0) {
      const placeholders = chaves.map(() => '?').join(', ');
      [itensProd, itensServ] = await Promise.all([
        firebirdQuery<ItemProdutoRow>(ITEM_PRODUTO_SELECT.replace('CHAVEOS = ?', `CHAVEOS IN (${placeholders})`), chaves),
        firebirdQuery<ItemServicoRow>(ITEM_SERVICO_SELECT.replace('CHAVEOS = ?', `CHAVEOS IN (${placeholders})`), chaves),
      ]);
    }
    const withItens = pageItems.map((os) => {
      const chave = headers.find((header) => header.IDENTIFICADOR === os.id)!.CHAVE;
      return {
        ...os,
        produtos: itensProd.filter((item) => item.CHAVEOS === chave).map(mapItemProduto),
        servicos: itensServ.filter((item) => item.CHAVEOS === chave).map(mapItemServico),
      };
    });

    return { items: withItens, total };
  }

  /**
   * Indicadores usam somente cabeçalhos em duas janelas indexáveis (abertura e fechamento).
   * A união em memória remove duplicidade sem trazer itens nem valores da OS.
   */
  async listarCabecalhos(situacaoDocumento?: number): Promise<OrdemServico[]> {
    const headers = await firebirdQuery<OSHeaderRow>(
      `${HEADER_SELECT}${situacaoDocumento === undefined ? '' : ' AND OS.SITUACAO = ?'}`,
      situacaoDocumento === undefined ? [] : [situacaoDocumento],
    );
    const workflows = await fetchWorkflows(headers.map((header) => header.IDENTIFICADOR));
    return headers.map((header) => buildOrdemServico(header, [], [], workflows.get(header.IDENTIFICADOR.toLowerCase())));
  }

  async listarParaDashboard(filter: OSDashboardFilter): Promise<OrdemServico[]> {
    const inicio = filter.dataInicial;
    const fim = filter.dataFinal;
    const [abertas, fechadas] = await Promise.all([
      firebirdQuery<OSHeaderRow>(`${HEADER_SELECT} AND OS.DATA >= ? AND OS.DATA <= ?`, [inicio, fim]),
      firebirdQuery<OSHeaderRow>(`${HEADER_SELECT} AND OS.DATAFECHA >= ? AND OS.DATAFECHA <= ?`, [inicio, fim]),
    ]);
    const headers = [...new Map([...abertas, ...fechadas].map((header) => [header.IDENTIFICADOR.toLowerCase(), header])).values()];
    const workflows = await fetchWorkflows(headers.map((header) => header.IDENTIFICADOR));
    return headers.map((header) => buildOrdemServico(header, [], [], workflows.get(header.IDENTIFICADOR.toLowerCase())));
  }

  /** Relatórios históricos têm semântica explícita e, quando necessário, trazem itens em lote. */
  async listarParaRelatorio(filter: OSReportFilter): Promise<OrdemServico[]> {
    const campoData = filter.dataReferencia === 'conclusao' ? 'OS.DATAFECHA' : 'OS.DATA';
    // Nunca exporta parcialmente: acima de 10 mil OS o usuário deve reduzir o período.
    const select = HEADER_SELECT.replace('SELECT', 'SELECT FIRST 10001');
    const conditions = [`${campoData} >= ?`, `${campoData} <= ?`];
    const params: unknown[] = [filter.dataInicial, filter.dataFinal];
    if (filter.situacaoDocumento !== undefined) {
      conditions.push('OS.SITUACAO = ?');
      params.push(filter.situacaoDocumento);
    }
    const headers = await firebirdQuery<OSHeaderRow>(`${select} AND ${conditions.join(' AND ')} ORDER BY OS.CHAVE DESC`, params);
    if (headers.length > 10_000) {
      throw new ValidationError('O período escolhido contém mais de 10.000 OS. Reduza o intervalo para gerar o relatório completo.');
    }

    const workflows = await fetchWorkflows(headers.map((header) => header.IDENTIFICADOR));
    if (!filter.incluirItens || headers.length === 0) {
      return headers.map((header) => buildOrdemServico(header, [], [], workflows.get(header.IDENTIFICADOR.toLowerCase())));
    }

    const produtosPorOS = new Map<number, ItemProdutoRow[]>();
    const servicosPorOS = new Map<number, ItemServicoRow[]>();
    for (let start = 0; start < headers.length; start += 500) {
      const chaves = headers.slice(start, start + 500).map((header) => header.CHAVE);
      const placeholders = chaves.map(() => '?').join(', ');
      const [produtos, servicos] = await Promise.all([
        firebirdQuery<ItemProdutoRow>(ITEM_PRODUTO_SELECT.replace('CHAVEOS = ?', `CHAVEOS IN (${placeholders})`), chaves),
        firebirdQuery<ItemServicoRow>(ITEM_SERVICO_SELECT.replace('CHAVEOS = ?', `CHAVEOS IN (${placeholders})`), chaves),
      ]);
      for (const produto of produtos) produtosPorOS.set(produto.CHAVEOS, [...(produtosPorOS.get(produto.CHAVEOS) ?? []), produto]);
      for (const servico of servicos) servicosPorOS.set(servico.CHAVEOS, [...(servicosPorOS.get(servico.CHAVEOS) ?? []), servico]);
    }

    return headers.map((header) =>
      buildOrdemServico(
        header,
        (produtosPorOS.get(header.CHAVE) ?? []).map(mapItemProduto),
        (servicosPorOS.get(header.CHAVE) ?? []).map(mapItemServico),
        workflows.get(header.IDENTIFICADOR.toLowerCase()),
      ),
    );
  }

  async buscarParaDashboard(termo: string): Promise<OrdemServico[]> {
    const term = toLatin1Param(termo);
    const select = HEADER_SELECT.replace('SELECT', 'SELECT FIRST 8');
    const headers = await firebirdQuery<OSHeaderRow>(
      `${select} AND (OS.ORDEM CONTAINING ? OR CLI.FANTASIA CONTAINING ? OR CLI.RAZAOSOCIAL CONTAINING ? OR EQ.IDENTIFICACAO CONTAINING ? OR EQ.DESCRICAO CONTAINING ?) ORDER BY OS.CHAVE DESC`,
      [term, term, term, term, term],
    );
    const workflows = await fetchWorkflows(headers.map((header) => header.IDENTIFICADOR));
    return headers.map((header) => buildOrdemServico(header, [], [], workflows.get(header.IDENTIFICADOR.toLowerCase())));
  }

  async criar(os: Omit<OrdemServico, 'id' | 'numero'>): Promise<OrdemServico> {
    // Toda OS nasce ABERTA (ver criarOS em os.service.ts) — '000001' é o único código possível aqui.
    const [chaveCliente, chaveEquipamento, chaveSituacaoAtendimento, perfilFiscalProduto] = await Promise.all([
      resolveChaveByCodigo('CLIFOR', os.clienteCodigo),
      resolveChaveByCodigo('EQUIPAMENTOS', os.equipamentoCodigo),
      resolveTabelaChave(CHAVETABELA_SITUACAO_ATENDIMENTO, '000001'),
      resolvePerfilFiscalPadrao('N'),
    ]);

    const identificador = await firebirdTransaction(async (query) => {
      const generatorRows = await query<{ PROXIMO: number }>(
        `SELECT GEN_ID(GEN_ORDEMSERVICO_ID, 1) AS PROXIMO FROM RDB$DATABASE`,
      );
      const chave = generatorRows[0]?.PROXIMO;
      if (chave === undefined) {
        throw new ExternalServiceError();
      }
      const ordem = String(chave).padStart(6, '0');
      const obs = encodeObs(os.observacoes, os.solucao);

      // Mesma rotina que o CHERP nativo usa (ver procedure AGRUPARDAVOS) pra tirar o próximo número
      // de DAV — contador por empresa em CONFIGCONT.NUMERODAV, incrementado atomicamente ali dentro.
      // Exige GRANT EXECUTE ON PROCEDURE ATUALIZARNUMERODAV (+ SELECT/UPDATE em CONFIGCONT) pro
      // usuário do app; sem essa permissão a OS é criada normalmente, só sem DAV (como já era).
      let nroDav: string | null = null;
      try {
        const davRows = await query<{ NUMERODAV: number }>(
          `SELECT NUMERODAV FROM ATUALIZARNUMERODAV(?)`,
          [CHAVE_EMPRESA],
        );
        const numeroDav = davRows[0]?.NUMERODAV;
        if (numeroDav !== undefined) {
          nroDav = String(numeroDav).padStart(13, '0');
        }
      } catch (err) {
        logger.warn({ err }, 'Sem permissão pra gerar NRODAV via ATUALIZARNUMERODAV — OS criada sem número de DAV.');
      }

      const insertRows = await query<{ IDENTIFICADOR: string }>(
        `INSERT INTO ORDEMSERVICO (
           CHAVE, ATIVO, CHAVEEMPRESA, ORDEM, DATA, HORAABERTURA, DATAFECHA, HORAFECHAMENTO, DATAENTREGA, TIPO, SITUACAO,
           CHAVECLIFOR, CHAVEEQUIPAMENTO, PROBLEMAABERTURAOS, LAUDOTECNICO, OBS, CHAVEUSUARIOINICIOU,
           TOTALPRODUTO, TOTALSERVICO, TOTALOS, CHAVESITUACAOOS, PRIORIDADE, NRODAV,
           CHAVECFOPOPERFISCAIS, CHAVECFOPPROD, CHAVECFOPSERV, CHAVETIPOATENDIMENTO
         ) VALUES (?, 1, ?, ?, CURRENT_DATE, CURRENT_TIME, NULL, NULL, NULL, 0, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?, 0)
         RETURNING IDENTIFICADOR`,
        [
          chave,
          CHAVE_EMPRESA,
          ordem,
          SITUACAO_ABERTO,
          chaveCliente,
          chaveEquipamento,
          toLatin1Param(os.problema),
          os.diagnostico ? toLatin1Param(os.diagnostico) : null,
          obs,
          os.cherpUsuarioChave ?? env.FIREBIRD_OS_USUARIO_CHAVE,
          chaveSituacaoAtendimento ?? null,
          PRIORIDADE_CODIGO_POR_STATUS[os.prioridade],
          nroDav,
          perfilFiscalProduto.chave,
          perfilFiscalProduto.chaveCfopProduto,
          perfilFiscalProduto.chaveCfopServico,
        ],
      );
      const identificadorGerado = insertRows[0]?.IDENTIFICADOR;
      if (!identificadorGerado) {
        throw new ExternalServiceError();
      }
      return identificadorGerado;
    });

    await db.insert(osWorkflow).values({
      id: identificador,
      status: os.status,
      prioridade: os.prioridade,
      responsavelId: os.responsavelId ?? null,
      tecnicoId: os.tecnicoId ?? null,
      dataPrevista: os.dataPrevista ? new Date(os.dataPrevista) : null,
      historico: os.historico,
    });

    const criada = await this.buscarPorId(identificador);
    if (!criada) {
      throw new NotFoundError('OS criada não pôde ser recarregada.', 'OS_NOT_FOUND');
    }
    return criada;
  }

  async atualizar(id: string, patch: Partial<OrdemServico>): Promise<OrdemServico> {
    const headers = await firebirdQuery<OSHeaderRow>(`${HEADER_SELECT} AND OS.IDENTIFICADOR = ?`, [id]);
    const header = headers[0];
    if (!header) {
      throw new NotFoundError('Ordem de serviço não encontrada.', 'OS_NOT_FOUND');
    }
    const chaveOS = header.CHAVE;

    const camposOSFB: Array<{ coluna: string; valor: unknown }> = [];

    if (patch.diagnostico !== undefined) {
      camposOSFB.push({ coluna: 'LAUDOTECNICO', valor: patch.diagnostico ? toLatin1Param(patch.diagnostico) : null });
    }
    if (patch.observacoes !== undefined || patch.solucao !== undefined) {
      const atual = decodeObs(header.OBS);
      const observacoes = patch.observacoes !== undefined ? patch.observacoes : atual.observacoes;
      const solucao = patch.solucao !== undefined ? patch.solucao : atual.solucao;
      camposOSFB.push({ coluna: 'OBS', valor: encodeObs(observacoes, solucao) });
    }
    // CONCLUIDA/CANCELADA não têm entrada em SITUACAO_ATENDIMENTO_CODIGO_POR_STATUS de propósito —
    // "Finalizar OS" trava só no nosso app (os_workflow.travado_local, abaixo), nunca escreve no CHERP.
    const codigoSituacaoAtendimento = patch.status !== undefined ? SITUACAO_ATENDIMENTO_CODIGO_POR_STATUS[patch.status] : undefined;
    if (codigoSituacaoAtendimento !== undefined) {
      const chaveSituacaoAtendimento = await resolveTabelaChave(CHAVETABELA_SITUACAO_ATENDIMENTO, codigoSituacaoAtendimento);
      if (chaveSituacaoAtendimento !== undefined) {
        camposOSFB.push({ coluna: 'CHAVESITUACAOOS', valor: chaveSituacaoAtendimento });
      }
    }
    if (patch.prioridade !== undefined) {
      camposOSFB.push({ coluna: 'PRIORIDADE', valor: PRIORIDADE_CODIGO_POR_STATUS[patch.prioridade] });
    }
    if (patch.kmAtual !== undefined) {
      camposOSFB.push({ coluna: 'KMATUAL', valor: patch.kmAtual });
    }
    if (patch.kmFinal !== undefined) {
      camposOSFB.push({ coluna: 'KMFINAL', valor: patch.kmFinal });
    }

    const perfisFiscais =
      patch.produtos !== undefined || patch.servicos !== undefined
        ? await Promise.all([resolvePerfilFiscalPadrao('N'), resolvePerfilFiscalPadrao('S')])
        : undefined;

    await firebirdTransaction(async (query) => {
      if (patch.produtos !== undefined || patch.servicos !== undefined) {
        const [perfilFiscalProduto, perfilFiscalServico] = perfisFiscais!;
        await query(
          `UPDATE ORDEMSERVICO SET
             CHAVECFOPOPERFISCAIS = COALESCE(CHAVECFOPOPERFISCAIS, ?),
             CHAVECFOPPROD = COALESCE(CHAVECFOPPROD, ?),
             CHAVECFOPSERV = COALESCE(CHAVECFOPSERV, ?),
             CHAVETIPOATENDIMENTO = COALESCE(CHAVETIPOATENDIMENTO, 0)
           WHERE CHAVE = ?`,
          [perfilFiscalProduto.chave, perfilFiscalProduto.chaveCfopProduto, perfilFiscalProduto.chaveCfopServico, chaveOS],
        );
        // NUMITEM é uma sequência única COMPARTILHADA entre ITENSORDEMSERVICOPROD e SERV pra uma
        // mesma OS (confirmado com dado real do CHERP na Fase B0 — produto e serviço se intercalam
        // na mesma contagem) — nunca numerar cada tabela separadamente, senão colide.
        const maxRows = await query<{ MAXIMO: number | null }>(
          `SELECT MAX(NUMITEM) AS MAXIMO FROM (
             SELECT NUMITEM FROM ITENSORDEMSERVICOPROD WHERE CHAVEOS = ?
             UNION ALL
             SELECT NUMITEM FROM ITENSORDEMSERVICOSERV WHERE CHAVEOS = ?
           ) X`,
          [chaveOS, chaveOS],
        );
        const numItemState = { proximo: (maxRows[0]?.MAXIMO ?? 0) + 1 };

        if (patch.produtos !== undefined) {
          await this.sincronizarItens(query, chaveOS, 'produto', patch.produtos, numItemState, perfilFiscalProduto);
        }
        if (patch.servicos !== undefined) {
          await this.sincronizarItens(query, chaveOS, 'servico', patch.servicos, numItemState, perfilFiscalServico);
        }
      }

      if (patch.produtos !== undefined || patch.servicos !== undefined) {
        const totaisRows = await query<{ TOTALPRODUTO: number | null; TOTALSERVICO: number | null }>(
          `SELECT
             (SELECT CASE WHEN COUNT(*) = 0 THEN 0 WHEN COUNT(*) <> COUNT(VLRTOTAL) THEN NULL ELSE SUM(VLRTOTAL) END FROM ITENSORDEMSERVICOPROD WHERE CHAVEOS = ? AND ATIVO = 1) AS TOTALPRODUTO,
             (SELECT CASE WHEN COUNT(*) = 0 THEN 0 WHEN COUNT(*) <> COUNT(VLRTOTAL) THEN NULL ELSE SUM(VLRTOTAL) END FROM ITENSORDEMSERVICOSERV WHERE CHAVEOS = ? AND ATIVO = 1) AS TOTALSERVICO
           FROM RDB$DATABASE`,
          [chaveOS, chaveOS],
        );
        const totalProduto = totaisRows[0]?.TOTALPRODUTO ?? null;
        const totalServico = totaisRows[0]?.TOTALSERVICO ?? null;
        const totalOS = totalProduto === null || totalServico === null ? null : Number(totalProduto) + Number(totalServico);
        await query(`UPDATE ORDEMSERVICO SET TOTALPRODUTO = ?, TOTALSERVICO = ?, TOTALOS = ? WHERE CHAVE = ?`, [
          totalProduto,
          totalServico,
          totalOS,
          chaveOS,
        ]);
      }

      if (camposOSFB.length > 0) {
        const sets: string[] = [];
        const params: unknown[] = [];
        for (const { coluna, valor } of camposOSFB) {
          sets.push(`${coluna} = ?`);
          params.push(valor);
        }
        params.push(chaveOS);
        await query(`UPDATE ORDEMSERVICO SET ${sets.join(', ')} WHERE CHAVE = ?`, params);
      }
    });

    const camposWorkflow: Partial<typeof osWorkflow.$inferInsert> = { updatedAt: new Date() };
    if (patch.status !== undefined) {
      camposWorkflow.status = patch.status;
      camposWorkflow.travadoLocal = patch.status === 'CONCLUIDA' || patch.status === 'CANCELADA';
    }
    if (patch.prioridade !== undefined) camposWorkflow.prioridade = patch.prioridade;
    if (patch.responsavelId !== undefined) camposWorkflow.responsavelId = patch.responsavelId ?? null;
    if (patch.tecnicoId !== undefined) camposWorkflow.tecnicoId = patch.tecnicoId ?? null;
    if (patch.dataPrevista !== undefined) camposWorkflow.dataPrevista = patch.dataPrevista ? new Date(patch.dataPrevista) : null;
    if (patch.historico !== undefined) camposWorkflow.historico = patch.historico;

    const existente = await fetchWorkflow(id);
    if (existente) {
      await db.update(osWorkflow).set(camposWorkflow).where(eq(osWorkflow.id, id));
    } else {
      // Primeira escrita feita pelo app numa OS que nasceu direto no CHERP — materializa a linha agora.
      const base = buildOrdemServico(header, [], [], undefined);
      await db.insert(osWorkflow).values({
        id,
        status: patch.status ?? base.status,
        prioridade: patch.prioridade ?? base.prioridade,
        responsavelId: patch.responsavelId ?? null,
        tecnicoId: patch.tecnicoId ?? null,
        dataPrevista: patch.dataPrevista ? new Date(patch.dataPrevista) : null,
        travadoLocal: patch.status === 'CONCLUIDA' || patch.status === 'CANCELADA',
        historico: patch.historico ?? base.historico,
      });
    }

    const atualizada = await this.buscarPorId(id);
    if (!atualizada) {
      throw new NotFoundError('Ordem de serviço não encontrada.', 'OS_NOT_FOUND');
    }
    return atualizada;
  }

  /**
   * Edita quantidade/preço de um item já lançado — UPDATE isolado, não passa pelo diff de
   * `sincronizarItens` (que de propósito nunca sobrescreve VLRUNIT/VLRTOTAL de um código já
   * existente, pra não atropelar recálculo feito pelo próprio CHERP num fluxo normal). Aqui é
   * uma edição explícita do usuário, então grava direto o que foi pedido; o desconto (DESCVLR)
   * que já estava no item é preservado, nunca zerado.
   */
  async atualizarItemProduto(id: string, produtoCodigo: string, patch: OSItemPatch): Promise<OrdemServico> {
    return this.atualizarItem('produto', id, produtoCodigo, patch);
  }

  async atualizarItemServico(id: string, servicoCodigo: string, patch: OSItemPatch): Promise<OrdemServico> {
    return this.atualizarItem('servico', id, servicoCodigo, patch);
  }

  private async atualizarItem(
    tipo: 'produto' | 'servico',
    id: string,
    codigo: string,
    patch: OSItemPatch,
  ): Promise<OrdemServico> {
    const tabela = tipo === 'produto' ? 'ITENSORDEMSERVICOPROD' : 'ITENSORDEMSERVICOSERV';
    const headers = await firebirdQuery<OSHeaderRow>(`${HEADER_SELECT} AND OS.IDENTIFICADOR = ?`, [id]);
    const header = headers[0];
    if (!header) {
      throw new NotFoundError('Ordem de serviço não encontrada.', 'OS_NOT_FOUND');
    }
    const chaveOS = header.CHAVE;

    await firebirdTransaction(async (query) => {
      const itens = await query<{ QTDE: number; VLRUNIT: number | null; DESCVLR: number | null }>(
        `SELECT QTDE, VLRUNIT, DESCVLR FROM ${tabela} WHERE CHAVEOS = ? AND CODPRODUTO = ? AND ATIVO = 1`,
        [chaveOS, codigo],
      );
      const item = itens[0];
      if (!item) {
        throw new NotFoundError('Item não encontrado nesta OS.', 'OS_ITEM_NOT_FOUND');
      }

      const novaQtde = patch.quantidade ?? item.QTDE;
      const novoPreco = patch.precoUnitario ?? item.VLRUNIT ?? 0;
      const desconto = item.DESCVLR ?? 0;
      const novoSubtotal = novaQtde * novoPreco;
      const novoTotal = novoSubtotal - desconto;

      if (patch.descricaoComplementar !== undefined) {
        await query(`UPDATE ${tabela} SET QTDE = ?, VLRUNIT = ?, VLRSUBTOTAL = ?, VLRTOTAL = ?, DESCRCOMPLEMENT = ? WHERE CHAVEOS = ? AND CODPRODUTO = ? AND ATIVO = 1`, [
          novaQtde,
          novoPreco,
          novoSubtotal,
          novoTotal,
          patch.descricaoComplementar ? toLatin1Param(patch.descricaoComplementar) : null,
          chaveOS,
          codigo,
        ]);
      } else {
        await query(
          `UPDATE ${tabela} SET QTDE = ?, VLRUNIT = ?, VLRSUBTOTAL = ?, VLRTOTAL = ? WHERE CHAVEOS = ? AND CODPRODUTO = ? AND ATIVO = 1`,
          [novaQtde, novoPreco, novoSubtotal, novoTotal, chaveOS, codigo],
        );
      }

      const totaisRows = await query<{ TOTALPRODUTO: number | null; TOTALSERVICO: number | null }>(
        `SELECT
           (SELECT CASE WHEN COUNT(*) = 0 THEN 0 WHEN COUNT(*) <> COUNT(VLRTOTAL) THEN NULL ELSE SUM(VLRTOTAL) END FROM ITENSORDEMSERVICOPROD WHERE CHAVEOS = ? AND ATIVO = 1) AS TOTALPRODUTO,
           (SELECT CASE WHEN COUNT(*) = 0 THEN 0 WHEN COUNT(*) <> COUNT(VLRTOTAL) THEN NULL ELSE SUM(VLRTOTAL) END FROM ITENSORDEMSERVICOSERV WHERE CHAVEOS = ? AND ATIVO = 1) AS TOTALSERVICO
         FROM RDB$DATABASE`,
        [chaveOS, chaveOS],
      );
      const totalProduto = totaisRows[0]?.TOTALPRODUTO ?? null;
      const totalServico = totaisRows[0]?.TOTALSERVICO ?? null;
      const totalOS = totalProduto === null || totalServico === null ? null : Number(totalProduto) + Number(totalServico);
      await query(`UPDATE ORDEMSERVICO SET TOTALPRODUTO = ?, TOTALSERVICO = ?, TOTALOS = ? WHERE CHAVE = ?`, [
        totalProduto,
        totalServico,
        totalOS,
        chaveOS,
      ]);
    });

    const atualizada = await this.buscarPorId(id);
    if (!atualizada) {
      throw new NotFoundError('Ordem de serviço não encontrada.', 'OS_NOT_FOUND');
    }
    return atualizada;
  }

  private async resolveChaveOS(id: string): Promise<number> {
    const headers = await firebirdQuery<{ CHAVE: number }>(`SELECT CHAVE FROM ORDEMSERVICO WHERE IDENTIFICADOR = ?`, [id]);
    const chave = headers[0]?.CHAVE;
    if (chave === undefined) {
      throw new NotFoundError('Ordem de serviço não encontrada.', 'OS_NOT_FOUND');
    }
    return chave;
  }

  /** Fotos da OS — ORDEMSERVICOIMG, tabela nativa do CHERP (mesmo padrão de CLIFORIMG/PRODUTOIMG). */
  async listarImagens(id: string): Promise<OSImagemMeta[]> {
    const chaveOS = await this.resolveChaveOS(id);
    const rows = await firebirdQuery<{ IDENTIFICADOR: string; DESCRICAO: string; NOMEARQUIVO: string; DATA: unknown }>(
      `SELECT IDENTIFICADOR, CAST(DESCRICAO AS VARCHAR(100) CHARACTER SET OCTETS) AS DESCRICAO,
              CAST(NOMEARQUIVO AS VARCHAR(100) CHARACTER SET OCTETS) AS NOMEARQUIVO, DATA
       FROM ORDEMSERVICOIMG WHERE CHAVEOS = ? AND ATIVO = 1 ORDER BY DATA`,
      [chaveOS],
    );
    return rows.map((row) => ({
      identificador: row.IDENTIFICADOR,
      descricao: row.DESCRICAO ?? '',
      nomeArquivo: row.NOMEARQUIVO,
      data: new Date(String(row.DATA)).toISOString(),
    }));
  }

  async adicionarImagem(id: string, imagem: OSImagemNova): Promise<void> {
    const chaveOS = await this.resolveChaveOS(id);
    // Sem CHAVE/IDENTIFICADOR na lista — o trigger ORDEMSERVICOIMG_BI gera os dois, mesmo
    // padrão já confirmado em ITENSORDEMSERVICOPROD/SERV.
    await firebirdQuery(
      `INSERT INTO ORDEMSERVICOIMG (ATIVO, CHAVEEMPRESA, DESCRICAO, IMG, CHAVEOS, NOMEARQUIVO, DATA, DATAHORAALT)
       VALUES (1, ?, ?, ?, ?, ?, CURRENT_DATE, CURRENT_TIMESTAMP)`,
      [
        CHAVE_EMPRESA,
        imagem.descricao ? toLatin1Param(imagem.descricao) : toLatin1Param(imagem.nomeArquivo),
        imagem.buffer,
        chaveOS,
        toLatin1Param(imagem.nomeArquivo),
      ],
    );
  }

  async buscarImagem(id: string, identificador: string): Promise<OSImagemArquivo | null> {
    const chaveOS = await this.resolveChaveOS(id);
    const rows = await firebirdQueryWithBlob<{ IMG: Buffer; NOMEARQUIVO: string }>(
      `SELECT IMG, CAST(NOMEARQUIVO AS VARCHAR(100) CHARACTER SET OCTETS) AS NOMEARQUIVO
       FROM ORDEMSERVICOIMG WHERE CHAVEOS = ? AND IDENTIFICADOR = ? AND ATIVO = 1`,
      [chaveOS, identificador],
      'IMG',
    );
    const row = rows[0];
    if (!row) return null;
    return { buffer: row.IMG, nomeArquivo: row.NOMEARQUIVO };
  }

  async excluir(id: string): Promise<void> {
    await firebirdQuery(`UPDATE ORDEMSERVICO SET ATIVO = 0 WHERE IDENTIFICADOR = ? AND ATIVO = 1`, [id]);
  }

  async removerImagem(id: string, identificador: string): Promise<void> {
    const chaveOS = await this.resolveChaveOS(id);
    await firebirdQuery(`UPDATE ORDEMSERVICOIMG SET ATIVO = 0 WHERE CHAVEOS = ? AND IDENTIFICADOR = ? AND ATIVO = 1`, [
      chaveOS,
      identificador,
    ]);
  }

  private async sincronizarItens(
    query: <R = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<R[]>,
    chaveOS: number,
    tipo: 'produto' | 'servico',
    novos: (OSItemProduto | OSItemServico)[],
    numItemState: { proximo: number },
    perfilFiscal: PerfilFiscal,
  ): Promise<void> {
    const tabela = tipo === 'produto' ? 'ITENSORDEMSERVICOPROD' : 'ITENSORDEMSERVICOSERV';
    const codigoDe = (item: OSItemProduto | OSItemServico): string =>
      'produtoCodigo' in item ? item.produtoCodigo : item.servicoCodigo;
    const valorUnitarioDe = (item: OSItemProduto | OSItemServico): number | undefined =>
      'produtoCodigo' in item ? item.precoUnitario : item.valorUnitario;

    const atuais = await query<{ CHAVE: number; CODIGO: string }>(
      `SELECT CHAVE, CODPRODUTO AS CODIGO FROM ${tabela} WHERE CHAVEOS = ? AND ATIVO = 1`,
      [chaveOS],
    );

    const novosCodigos = new Set(novos.map(codigoDe));
    const atuaisCodigos = new Set(atuais.map((a) => a.CODIGO));

    const remover = atuais.filter((a) => !novosCodigos.has(a.CODIGO));
    const adicionar = novos.filter((n) => !atuaisCodigos.has(codigoDe(n)));

    const dadosFiscais = (produto: ProdutoParaOS) => {
      const chavePerfil = tipo === 'produto' ? produto.chavePerfilFiscalProduto ?? perfilFiscal.chave : perfilFiscal.chave;
      const chaveCfop = tipo === 'produto' ? produto.chaveCfopProduto ?? perfilFiscal.chaveCfopProduto : perfilFiscal.chaveCfopServico;
      return { chavePerfil, chaveCfop };
    };

    const preencherCompatibilidade = async (chaveItem: number, produto: ProdutoParaOS) => {
      const fiscal = dadosFiscais(produto);
      if (tipo === 'produto') {
        await query(
          `UPDATE ITENSORDEMSERVICOPROD SET
             CHAVETRIBUTACAO = COALESCE(CHAVETRIBUTACAO, ?), CHAVECFOP = COALESCE(CHAVECFOP, ?),
             CHAVECFOPOPERFISCAIS = COALESCE(CHAVECFOPOPERFISCAIS, ?), PRECOCUSTO = COALESCE(PRECOCUSTO, ?),
             VLRUNITTABELA = COALESCE(VLRUNITTABELA, ?), VLRVENDAMINIMO = COALESCE(VLRVENDAMINIMO, ?),
             CHAVEDPTOESTOQUE = COALESCE(CHAVEDPTOESTOQUE, ?)
           WHERE CHAVE = ?`,
          [produto.chaveTributacao, fiscal.chaveCfop, fiscal.chavePerfil, produto.precoCusto, produto.precoVenda, produto.precoVendaMinimo, produto.chaveDptoEstoque, chaveItem],
        );
      } else {
        await query(
          `UPDATE ITENSORDEMSERVICOSERV SET
             CHAVECFOP = COALESCE(CHAVECFOP, ?), CHAVECFOPOPERFISCAIS = COALESCE(CHAVECFOPOPERFISCAIS, ?),
             PRECOCUSTO = COALESCE(PRECOCUSTO, ?), VLRUNITTABELA = COALESCE(VLRUNITTABELA, ?),
             VLRVENDAMINIMO = COALESCE(VLRVENDAMINIMO, ?)
           WHERE CHAVE = ?`,
          [fiscal.chaveCfop, fiscal.chavePerfil, produto.precoCusto, produto.precoVenda, produto.precoVendaMinimo, chaveItem],
        );
      }
    };

    for (const item of remover) {
      await query(`UPDATE ${tabela} SET ATIVO = 0 WHERE CHAVE = ?`, [item.CHAVE]);
    }

    // Corrige itens já criados pelo app nas versões anteriores, sem alterar valores que o CHERP calculou.
    for (const item of atuais.filter((atual) => novosCodigos.has(atual.CODIGO))) {
      await preencherCompatibilidade(item.CHAVE, await resolveProduto(item.CODIGO));
    }

    // MOVESTOQUE só existe em ITENSORDEMSERVICOPROD (confirmado na Fase B0) — não em SERV.
    const colunaMovEstoque = tipo === 'produto' ? ', MOVESTOQUE' : '';
    const valorMovEstoque = tipo === 'produto' ? ', 0' : '';

    for (const item of adicionar) {
      const codigo = codigoDe(item);
      const produto = await resolveProduto(codigo);
      const fiscal = dadosFiscais(produto);
      const valorUnitario = valorUnitarioDe(item);
      const total = item.total;
      const desconto = item.desconto ?? null;

      await query(
        `INSERT INTO ${tabela} (
           CHAVEEMPRESA, ATIVO, CHAVEOS, CHAVEPRODUTO, CODPRODUTO, PRODUTO, DESCRCOMPLEMENT, CHAVEUNIDADE, UN,
           QTDE, VLRUNIT, DESCPORC, DESCVLR, VLRSUBTOTAL, VLRTOTAL, CHAVETABELAPRECO,
           CHAVECFOP, CHAVECFOPOPERFISCAIS, PRECOCUSTO, VLRUNITTABELA, VLRVENDAMINIMO${tipo === 'produto' ? ', CHAVETRIBUTACAO, CHAVEDPTOESTOQUE' : ''},
           DATA, NUMITEM${colunaMovEstoque}
         ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?${tipo === 'produto' ? ', ?, ?' : ''}, CURRENT_DATE, ?${valorMovEstoque})`,
        [
          CHAVE_EMPRESA,
          chaveOS,
          produto.chave,
          codigo,
          toLatin1Param(item.descricao),
          item.descricaoComplementar ? toLatin1Param(item.descricaoComplementar) : null,
          produto.chaveUnidade,
          item.unidade,
          item.quantidade,
          valorUnitario ?? null,
          desconto,
          total ?? null,
          total ?? null,
          CHAVE_TABELA_PRECO,
          fiscal.chaveCfop,
          fiscal.chavePerfil,
          produto.precoCusto,
          produto.precoVenda,
          produto.precoVendaMinimo,
          ...(tipo === 'produto' ? [produto.chaveTributacao, produto.chaveDptoEstoque] : []),
          numItemState.proximo++,
        ],
      );
    }
  }
}
