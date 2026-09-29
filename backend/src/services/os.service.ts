import { toOSDTO } from '../dto/mappers/os.mapper.js';
import { userRepository } from '../repositories/postgres/UserRepository.js';
import type { AdminOSDTO, OperationalOSDTO } from '../dto/os.dto.js';
import { ConflictError } from '../errors/ConflictError.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { ValidationError } from '../errors/ValidationError.js';
import {
  clienteRepository,
  equipamentoRepository,
  osRepository,
  produtoRepository,
  servicoRepository,
} from '../repositories/index.js';
import type { OSListFilter } from '../repositories/interfaces/IOSRepository.js';
import type { AuthenticatedUser, Permission } from '../types/auth.types.js';
import type {
  OrdemServico,
  OSHistoricoEntry,
  OSPrioridade,
  OSStatus,
} from '../types/cherp.types.js';
import { detectarTipoImagem } from '../utils/imageSignature.js';
import type { RequestContext } from '../utils/requestContext.js';
import { recordAudit } from './auditLog.service.js';
import { assertValidTransition } from './osWorkflow.js';
import { enqueueStatusMessages } from './osCommunication.service.js';
import { logger } from '../utils/logger.js';

function historicoEntry(evento: string, usuario: AuthenticatedUser): OSHistoricoEntry {
  return { timestamp: new Date().toISOString(), evento, usuarioNome: usuario.name };
}

/** Auditoria de negócio (seção 24) — trilha durável e protegida, separada do histórico exibido na OS. */
function auditOS(
  event: string,
  osId: string,
  usuario: AuthenticatedUser,
  ctx: RequestContext,
  changes?: unknown,
) {
  return recordAudit({
    userId: usuario.id,
    userName: usuario.name,
    event,
    entityType: 'OS',
    entityId: osId,
    changes,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}

/** Soma os totais de produtos e serviços. `undefined` se algum item não tiver preço (nunca inventa valor). */
function calcularFaturamento(
  produtos: OrdemServico['produtos'],
  servicos: OrdemServico['servicos'],
): number | undefined {
  const totais = [...produtos.map((p) => p.total), ...servicos.map((s) => s.total)];
  if (totais.some((t) => t === undefined)) return undefined;
  return totais.reduce<number>((acc, t) => acc + (t ?? 0), 0);
}

async function getOSOrThrow(id: string): Promise<OrdemServico> {
  const os = await osRepository.buscarPorId(id);
  if (!os) {
    throw new NotFoundError('Ordem de serviço não encontrada.', 'OS_NOT_FOUND');
  }
  return os;
}

/**
 * Bloqueio de edição depende só de sinais fiscais reais (situação/documento do CHERP, data nativa
 * de fechamento) e do próprio "Finalizar OS" do app (`travadoLocal`) — nunca da situação de
 * atendimento (PRONTA não trava mais nada sozinha, é só o mecânico sinalizando "terminei", o
 * pedido/NF pode ainda nem ter sido gerado). "Finalizar OS" (Fase OS-6) muda o status pra CONCLUIDA
 * só no nosso app — nunca fecha a OS no CHERP (ver `atualizar` em OSRepository.firebird.ts), de
 * propósito, pro time de faturamento continuar processando por lá. Em compensação, o mecânico não
 * pode mais editar nada por aqui depois disso — o backend garante isso em toda mutação, não só a UI.
 */
function assertNaoFinalizada(os: OrdemServico): void {
  if (
    (os.situacaoDocumento !== undefined && os.situacaoDocumento !== 0) ||
    os.dataConclusao ||
    os.travadoLocal
  ) {
    throw new ValidationError(
      'OS fechada ou com pedido/NF gerado no CHERP é somente consulta e não pode ser alterada.',
    );
  }
}

export async function listOS(
  filter: OSListFilter,
  permissions: Permission[],
  userId?: string,
): Promise<{ items: (OperationalOSDTO | AdminOSDTO)[]; total: number }> {
  // Sem OS_VIEW_FINALIZADAS, OS finalizada pelo app some da lista (a OS continua abrindo só leitura por link).
  const verFinalizadas = permissions.includes('OS_VIEW_FINALIZADAS');
  const fixed = userId ? await userRepository.getFixedOSFilters(userId) : null;
  const result = await osRepository.listar({
    ...filter,
    ...(fixed?.osStatusFixo != null ? { situacaoDocumento: fixed.osStatusFixo } : {}),
    ...(fixed?.osSituacaoAtendimentoFixa
      ? { situacaoAtendimento: fixed.osSituacaoAtendimentoFixa }
      : {}),
    ocultarFinalizadasApp: !verFinalizadas,
    somenteFinalizadasApp:
      verFinalizadas && fixed?.osStatusFixo == null && filter.somenteFinalizadasApp,
  });
  return { items: result.items.map((os) => toOSDTO(os, permissions)), total: result.total };
}

export async function getOSById(
  id: string,
  permissions: Permission[],
): Promise<OperationalOSDTO | AdminOSDTO> {
  const os = await getOSOrThrow(id);
  return toOSDTO(os, permissions);
}

interface CriarOSInput {
  clienteCodigo: string;
  equipamentoCodigo: string;
  problema: string;
  prioridade: OSPrioridade;
  responsavelId?: string;
  tecnicoId?: string;
  dataPrevista?: string;
  kmAtual: number;
  kmFinal: number;
}

function assertKmObrigatorios(kmAtual: number, kmFinal: number): void {
  if (![kmAtual, kmFinal].every((km) => Number.isSafeInteger(km) && km >= 0 && km <= 99_999_999)) {
    throw new ValidationError('Informe KM inicial e KM final válidos.');
  }
}

export async function criarOS(
  input: CriarOSInput,
  usuario: AuthenticatedUser,
  ctx: RequestContext = {},
): Promise<OperationalOSDTO | AdminOSDTO> {
  assertKmObrigatorios(input.kmAtual, input.kmFinal);
  const cliente = await clienteRepository.buscarPorCodigo(input.clienteCodigo);
  if (!cliente) {
    throw new ValidationError(`Cliente com código "${input.clienteCodigo}" não encontrado.`);
  }
  if (cliente.ativo === false) {
    throw new ValidationError('Cliente inativo no CHERP. Ative o cadastro antes de abrir a OS.');
  }
  const equipamento = await equipamentoRepository.buscarPorCodigo(input.equipamentoCodigo);
  if (!equipamento) {
    throw new ValidationError(
      `Equipamento com código "${input.equipamentoCodigo}" não encontrado.`,
    );
  }
  if (equipamento.clienteCodigo !== input.clienteCodigo) {
    throw new ValidationError('O equipamento informado não pertence ao cliente informado.');
  }

  const novo = await osRepository.criar({
    clienteCodigo: input.clienteCodigo,
    equipamentoCodigo: input.equipamentoCodigo,
    problema: input.problema,
    prioridade: input.prioridade,
    kmAtual: input.kmAtual,
    kmFinal: input.kmFinal,
    responsavelId: input.responsavelId,
    tecnicoId: input.tecnicoId,
    dataPrevista: input.dataPrevista,
    status: 'ABERTA',
    produtos: [],
    servicos: [],
    historico: [historicoEntry('OS criada', usuario)],
    dataAbertura: new Date().toISOString(),
    cherpUsuarioChave: usuario.cherpUsuarioChave,
  });

  await auditOS('OS_CREATED', novo.id, usuario, ctx, { after: input });

  try {
    await enqueueStatusMessages(novo, 'ABERTA');
  } catch (error) {
    logger.warn(
      { err: error, osId: novo.id },
      'Não foi possível enfileirar aviso de abertura da OS',
    );
  }

  return toOSDTO(novo, usuario.permissions);
}

/**
 * Exclusão lógica da OS inteira (ATIVO = 0 no CHERP). Só OS aberta — mesma regra de bloqueio
 * das demais mutações (`assertNaoFinalizada`), pra nunca sumir com documento fiscal/faturado.
 * O motivo é obrigatório e fica na trilha de auditoria junto com um retrato da OS excluída.
 */
export async function excluirOS(
  id: string,
  motivo: string,
  usuario: AuthenticatedUser,
  ctx: RequestContext = {},
): Promise<void> {
  const atual = await getOSOrThrow(id);
  assertNaoFinalizada(atual);

  await osRepository.excluir(id);

  await auditOS('OS_DELETED', id, usuario, ctx, {
    motivo,
    before: {
      numero: atual.numero,
      nroDav: atual.nroDav,
      clienteCodigo: atual.clienteCodigo,
      clienteNome: atual.clienteNome,
      equipamentoCodigo: atual.equipamentoCodigo,
      equipamentoDescricao: atual.equipamentoDescricao,
      status: atual.status,
      problema: atual.problema,
      produtos: atual.produtos.length,
      servicos: atual.servicos.length,
    },
  });
}

/**
 * Desfaz "Finalizar OS"/cancelamento feito pelo app: destrava a edição e volta a OS pra "Em atendimento".
 * Só vale pra trava do nosso lado (`travadoLocal`) — OS com pedido/NF gerado ou fechada no CHERP é decisão
 * fiscal de lá e continua somente consulta. Exige permissão própria (OS_REOPEN) e motivo, auditado.
 */
export async function reabrirOS(
  id: string,
  motivo: string,
  usuario: AuthenticatedUser,
  ctx: RequestContext = {},
): Promise<OperationalOSDTO | AdminOSDTO> {
  const atual = await getOSOrThrow(id);
  if ((atual.situacaoDocumento ?? 0) !== 0) {
    throw new ValidationError(
      'Esta OS já tem pedido/NF gerado no CHERP e só pode ser reaberta por lá.',
    );
  }
  if (!atual.travadoLocal) {
    throw new ValidationError(
      atual.dataConclusao
        ? 'Esta OS foi fechada no CHERP e só pode ser reaberta por lá.'
        : 'Esta OS não está finalizada.',
    );
  }

  const atualizado = await osRepository.atualizar(id, {
    status: 'ABERTA',
    travadoLocal: false,
    dataConclusao: undefined,
    historico: [...atual.historico, historicoEntry(`OS reaberta (motivo: ${motivo})`, usuario)],
    cherpUsuarioChave: usuario.cherpUsuarioChave,
  });

  await auditOS('OS_REOPENED', id, usuario, ctx, { motivo, before: atual.status, after: 'ABERTA' });
  return toOSDTO(atualizado, usuario.permissions);
}

/**
 * Cria uma OS nova a partir de outra (cabeçalho, itens e diagnóstico). Funciona mesmo com a
 * origem finalizada / com pedido gerado — a origem nunca é alterada, só lida. A OS nova nasce
 * aberta, com número e DAV próprios (gerados pelo `criar` do repositório) e sem fotos/histórico.
 */
export async function duplicarOS(
  id: string,
  usuario: AuthenticatedUser,
  km: { kmAtual: number; kmFinal: number },
  ctx: RequestContext = {},
): Promise<OperationalOSDTO | AdminOSDTO> {
  assertKmObrigatorios(km.kmAtual, km.kmFinal);
  const origem = await getOSOrThrow(id);

  const criada = await osRepository.criar({
    clienteCodigo: origem.clienteCodigo,
    equipamentoCodigo: origem.equipamentoCodigo,
    problema: origem.problema,
    prioridade: origem.prioridade,
    kmAtual: km.kmAtual,
    kmFinal: km.kmFinal,
    responsavelId: origem.responsavelId,
    tecnicoId: origem.tecnicoId,
    status: 'ABERTA',
    produtos: [],
    servicos: [],
    historico: [historicoEntry(`OS criada por duplicação da OS #${origem.numero}`, usuario)],
    dataAbertura: new Date().toISOString(),
    cherpUsuarioChave: usuario.cherpUsuarioChave,
  });

  const temItens = origem.produtos.length > 0 || origem.servicos.length > 0;
  const temDiagnostico =
    origem.diagnostico !== undefined ||
    origem.observacoes !== undefined;

  let nova = criada;
  if (temItens || temDiagnostico) {
    nova = await osRepository.atualizar(criada.id, {
      ...(temItens ? { produtos: origem.produtos, servicos: origem.servicos } : {}),
      ...(temItens ? { faturamento: calcularFaturamento(origem.produtos, origem.servicos) } : {}),
      diagnostico: origem.diagnostico,
      observacoes: origem.observacoes,
      cherpUsuarioChave: usuario.cherpUsuarioChave,
    });
  }

  await auditOS('OS_DUPLICATED', nova.id, usuario, ctx, {
    origemId: origem.id,
    numeroOrigem: origem.numero,
    numeroNovo: nova.numero,
    produtos: origem.produtos.length,
    servicos: origem.servicos.length,
  });

  return toOSDTO(nova, usuario.permissions);
}

interface AtualizarOSInput {
  diagnostico?: string;
  observacoes?: string;
  prioridade?: OSPrioridade;
  responsavelId?: string;
  tecnicoId?: string;
  dataPrevista?: string;
  kmAtual?: number;
  kmFinal?: number;
  base?: OSBaseEdicao;
}

/** Campos de texto livre/KM editados na aba Diagnóstico — os que sofrem com edição simultânea. */
export interface OSBaseEdicao {
  diagnostico?: string;
  observacoes?: string;
  kmAtual?: number | null;
  kmFinal?: number | null;
}

function normalizarCampo(valor: unknown): string {
  if (valor === undefined || valor === null) return '';
  return String(valor).trim().toLocaleUpperCase('pt-BR');
}

/**
 * Concorrência otimista: compara o valor que o usuário viu ao começar a editar com o valor atual,
 * só nos campos que ele está gravando. Mudança em outro campo (ou item) não gera conflito.
 */
function assertSemConflito(atual: OrdemServico, patch: AtualizarOSInput): void {
  const { base } = patch;
  if (!base) return;
  const campos = (Object.keys(base) as (keyof OSBaseEdicao)[]).filter(
    (k) => patch[k] !== undefined,
  );
  const conflitantes = campos.filter((k) => normalizarCampo(atual[k]) !== normalizarCampo(base[k]));
  if (conflitantes.length === 0) return;
  throw new ConflictError(
    'Outro usuário alterou esta OS enquanto você editava. Seu texto foi mantido na tela.',
    'OS_CONFLICT',
    {
      campos: conflitantes,
      atual: Object.fromEntries(conflitantes.map((k) => [k, atual[k] ?? null])),
    },
  );
}

export async function atualizarOS(
  id: string,
  patch: AtualizarOSInput,
  usuario: AuthenticatedUser,
  ctx: RequestContext = {},
): Promise<OperationalOSDTO | AdminOSDTO> {
  const atual = await getOSOrThrow(id);
  assertNaoFinalizada(atual);
  assertSemConflito(atual, patch);

  const campos: AtualizarOSInput = { ...patch };
  delete campos.base;
  const camposAlterados = Object.keys(campos).filter(
    (key) => campos[key as keyof AtualizarOSInput] !== undefined,
  ) as Exclude<keyof AtualizarOSInput, 'base'>[];

  const atualizado = await osRepository.atualizar(id, {
    ...campos,
    cherpUsuarioChave: usuario.cherpUsuarioChave,
    historico: [
      ...atual.historico,
      historicoEntry(`OS atualizada (${camposAlterados.join(', ')})`, usuario),
    ],
  });

  const before = Object.fromEntries(camposAlterados.map((k) => [k, atual[k]]));
  const after = Object.fromEntries(camposAlterados.map((k) => [k, campos[k]]));
  await auditOS('OS_UPDATED', id, usuario, ctx, { before, after });

  return toOSDTO(atualizado, usuario.permissions);
}

export async function alterarStatusOS(
  id: string,
  novoStatus: OSStatus,
  usuario: AuthenticatedUser,
  ctx: RequestContext = {},
): Promise<OperationalOSDTO | AdminOSDTO> {
  const atual = await getOSOrThrow(id);
  assertNaoFinalizada(atual);
  assertValidTransition(atual.status, novoStatus);

  const patch: Partial<OrdemServico> = {
    status: novoStatus,
    historico: [
      ...atual.historico,
      historicoEntry(`Status alterado para "${novoStatus}"`, usuario),
    ],
    cherpUsuarioChave: usuario.cherpUsuarioChave,
  };
  if (novoStatus === 'CONCLUIDA') {
    patch.dataConclusao = new Date().toISOString();
  }

  const atualizado = await osRepository.atualizar(id, patch);

  await auditOS('OS_STATUS_CHANGED', id, usuario, ctx, { before: atual.status, after: novoStatus });

  // A mudança da OS já foi salva. Falha no aviso nunca desfaz o status.
  try {
    await enqueueStatusMessages(atualizado, novoStatus);
  } catch (error) {
    logger.warn({ err: error, osId: id }, 'Não foi possível enfileirar aviso da OS');
  }

  return toOSDTO(atualizado, usuario.permissions);
}

export async function adicionarProdutoOS(
  id: string,
  produtoCodigo: string,
  quantidade: number,
  usuario: AuthenticatedUser,
  ctx: RequestContext = {},
  precoUnitarioOverride?: number,
  descricaoComplementar?: string,
): Promise<OperationalOSDTO | AdminOSDTO> {
  const atual = await getOSOrThrow(id);
  assertNaoFinalizada(atual);
  const produto = await produtoRepository.buscarPorCodigo(produtoCodigo);
  if (!produto) {
    throw new ValidationError(`Produto com código "${produtoCodigo}" não encontrado.`);
  }
  // Sem registro de estoque no CHERP (disponivel ausente) também é zerado.
  if ((produto.disponivel ?? 0) <= 0) {
    throw new ValidationError(
      `"${produto.descricao}" está com estoque zerado e não pode ser lançado. Verifique com o responsável pelo estoque.`,
    );
  }

  const precoUnitario =
    usuario.permissions.includes('FINANCIAL_EDIT') && precoUnitarioOverride !== undefined
      ? precoUnitarioOverride
      : produto.precoUnitario;
  const total = precoUnitario !== undefined ? precoUnitario * quantidade : undefined;
  const novoItem = {
    produtoCodigo: produto.codigo,
    descricao: produto.descricao,
    unidade: produto.unidade,
    quantidade,
    precoUnitario,
    desconto: 0,
    total,
    descricaoComplementar,
  };
  const produtos = [...atual.produtos, novoItem];

  const atualizado = await osRepository.atualizar(id, {
    produtos,
    faturamento: calcularFaturamento(produtos, atual.servicos),
    historico: [
      ...atual.historico,
      historicoEntry(`Produto adicionado: ${produto.descricao}`, usuario),
    ],
    cherpUsuarioChave: usuario.cherpUsuarioChave,
  });

  await auditOS('OS_PRODUCT_ADDED', id, usuario, ctx, { after: novoItem });

  return toOSDTO(atualizado, usuario.permissions);
}

export async function removerProdutoOS(
  id: string,
  produtoCodigo: string,
  usuario: AuthenticatedUser,
  ctx: RequestContext = {},
  itemId?: number,
): Promise<OperationalOSDTO | AdminOSDTO> {
  const atual = await getOSOrThrow(id);
  assertNaoFinalizada(atual);
  const correspondentes = atual.produtos.filter((p) => p.produtoCodigo === produtoCodigo);
  if (itemId === undefined && correspondentes.length > 1)
    throw new ValidationError('Selecione a linha do produto.');
  const item = correspondentes.find((p) => itemId === undefined || p.itemId === itemId);
  if (!item) {
    throw new NotFoundError('Produto não encontrado nesta OS.', 'OS_ITEM_NOT_FOUND');
  }

  const produtos = atual.produtos.filter((p) => p !== item);
  const atualizado = await osRepository.atualizar(id, {
    produtos,
    faturamento: calcularFaturamento(produtos, atual.servicos),
    historico: [...atual.historico, historicoEntry(`Produto removido: ${item.descricao}`, usuario)],
    cherpUsuarioChave: usuario.cherpUsuarioChave,
  });

  await auditOS('OS_PRODUCT_REMOVED', id, usuario, ctx, { before: item });

  return toOSDTO(atualizado, usuario.permissions);
}

export async function adicionarServicoOS(
  id: string,
  servicoCodigo: string,
  quantidade: number,
  usuario: AuthenticatedUser,
  ctx: RequestContext = {},
  valorUnitarioOverride?: number,
  descricaoComplementar?: string,
): Promise<OperationalOSDTO | AdminOSDTO> {
  const atual = await getOSOrThrow(id);
  assertNaoFinalizada(atual);
  const servico = await servicoRepository.buscarPorCodigo(servicoCodigo);
  if (!servico) {
    throw new ValidationError(`Serviço com código "${servicoCodigo}" não encontrado.`);
  }

  const valorUnitario =
    usuario.permissions.includes('FINANCIAL_EDIT') && valorUnitarioOverride !== undefined
      ? valorUnitarioOverride
      : servico.valorUnitario;
  const total = valorUnitario !== undefined ? valorUnitario * quantidade : undefined;
  const novoItem = {
    servicoCodigo: servico.codigo,
    descricao: servico.descricao,
    unidade: servico.unidade,
    quantidade,
    valorUnitario,
    desconto: 0,
    total,
    descricaoComplementar,
  };
  const servicos = [...atual.servicos, novoItem];

  const atualizado = await osRepository.atualizar(id, {
    servicos,
    faturamento: calcularFaturamento(atual.produtos, servicos),
    historico: [
      ...atual.historico,
      historicoEntry(`Serviço adicionado: ${servico.descricao}`, usuario),
    ],
    cherpUsuarioChave: usuario.cherpUsuarioChave,
  });

  await auditOS('OS_SERVICE_ADDED', id, usuario, ctx, { after: novoItem });

  return toOSDTO(atualizado, usuario.permissions);
}

export async function removerServicoOS(
  id: string,
  servicoCodigo: string,
  usuario: AuthenticatedUser,
  ctx: RequestContext = {},
  itemId?: number,
): Promise<OperationalOSDTO | AdminOSDTO> {
  const atual = await getOSOrThrow(id);
  assertNaoFinalizada(atual);
  const correspondentes = atual.servicos.filter((s) => s.servicoCodigo === servicoCodigo);
  if (itemId === undefined && correspondentes.length > 1)
    throw new ValidationError('Selecione a linha do serviço.');
  const item = correspondentes.find((s) => itemId === undefined || s.itemId === itemId);
  if (!item) {
    throw new NotFoundError('Serviço não encontrado nesta OS.', 'OS_ITEM_NOT_FOUND');
  }

  const servicos = atual.servicos.filter((s) => s !== item);
  const atualizado = await osRepository.atualizar(id, {
    servicos,
    faturamento: calcularFaturamento(atual.produtos, servicos),
    historico: [...atual.historico, historicoEntry(`Serviço removido: ${item.descricao}`, usuario)],
    cherpUsuarioChave: usuario.cherpUsuarioChave,
  });

  await auditOS('OS_SERVICE_REMOVED', id, usuario, ctx, { before: item });

  return toOSDTO(atualizado, usuario.permissions);
}

/**
 * "Desfazer" depois de remover um item: reinsere a última linha removida (mesma quantidade, preço,
 * desconto e descrição complementar) pelo mesmo caminho de inserção de sempre — nunca reativa a linha
 * antiga (ATIVO = 1) pra não depender de trigger do CHERP. O preço vem do servidor, nunca do cliente.
 */
export async function restaurarItemOS(
  id: string,
  tipo: 'produto' | 'servico',
  codigo: string,
  usuario: AuthenticatedUser,
  ctx: RequestContext = {},
  itemId?: number,
): Promise<OperationalOSDTO | AdminOSDTO> {
  const atual = await getOSOrThrow(id);
  assertNaoFinalizada(atual);

  if (tipo === 'produto') {
    if (itemId === undefined && atual.produtos.some((p) => p.produtoCodigo === codigo)) {
      throw new ValidationError('Este produto já está na OS.');
    }
    const item = await osRepository.buscarProdutoRemovido(id, codigo, itemId);
    if (!item)
      throw new NotFoundError('Não há produto removido para restaurar.', 'OS_ITEM_NOT_FOUND');
    const produtos = [...atual.produtos, { ...item, itemId: undefined }];
    const atualizado = await osRepository.atualizar(id, {
      produtos,
      faturamento: calcularFaturamento(produtos, atual.servicos),
      historico: [
        ...atual.historico,
        historicoEntry(`Produto restaurado: ${item.descricao}`, usuario),
      ],
      cherpUsuarioChave: usuario.cherpUsuarioChave,
    });
    await auditOS('OS_PRODUCT_RESTORED', id, usuario, ctx, { after: item });
    return toOSDTO(atualizado, usuario.permissions);
  }

  if (itemId === undefined && atual.servicos.some((s) => s.servicoCodigo === codigo)) {
    throw new ValidationError('Este serviço já está na OS.');
  }
  const item = await osRepository.buscarServicoRemovido(id, codigo, itemId);
  if (!item)
    throw new NotFoundError('Não há serviço removido para restaurar.', 'OS_ITEM_NOT_FOUND');
  const servicos = [...atual.servicos, { ...item, itemId: undefined }];
  const atualizado = await osRepository.atualizar(id, {
    servicos,
    faturamento: calcularFaturamento(atual.produtos, servicos),
    historico: [
      ...atual.historico,
      historicoEntry(`Serviço restaurado: ${item.descricao}`, usuario),
    ],
    cherpUsuarioChave: usuario.cherpUsuarioChave,
  });
  await auditOS('OS_SERVICE_RESTORED', id, usuario, ctx, { after: item });
  return toOSDTO(atualizado, usuario.permissions);
}

export interface OSItemPatchInput {
  quantidade?: number;
  precoUnitario?: number;
  descricaoComplementar?: string;
}

/** Edita quantidade/preço de um produto já lançado — sem permissão FINANCIAL_EDIT, o preço enviado é ignorado. */
export async function atualizarProdutoOS(
  id: string,
  produtoCodigo: string,
  patch: OSItemPatchInput,
  usuario: AuthenticatedUser,
  ctx: RequestContext = {},
  itemId?: number,
): Promise<OperationalOSDTO | AdminOSDTO> {
  const atual = await getOSOrThrow(id);
  assertNaoFinalizada(atual);
  const correspondentes = atual.produtos.filter((p) => p.produtoCodigo === produtoCodigo);
  if (itemId === undefined && correspondentes.length > 1)
    throw new ValidationError('Selecione a linha do produto.');
  const item = correspondentes.find((p) => itemId === undefined || p.itemId === itemId);
  if (!item) {
    throw new NotFoundError('Produto não encontrado nesta OS.', 'OS_ITEM_NOT_FOUND');
  }

  const precoUnitario = usuario.permissions.includes('FINANCIAL_EDIT')
    ? patch.precoUnitario
    : undefined;
  await osRepository.atualizarItemProduto(id, produtoCodigo, {
    itemId,
    quantidade: patch.quantidade,
    precoUnitario,
    descricaoComplementar: patch.descricaoComplementar,
  });

  const atualizado = await osRepository.atualizar(id, {
    historico: [
      ...atual.historico,
      historicoEntry(`Produto atualizado: ${item.descricao}`, usuario),
    ],
    cherpUsuarioChave: usuario.cherpUsuarioChave,
  });

  await auditOS('OS_PRODUCT_UPDATED', id, usuario, ctx, { before: item, after: patch });

  return toOSDTO(atualizado, usuario.permissions);
}

/** Edita quantidade/preço de um serviço já lançado — sem permissão FINANCIAL_EDIT, o preço enviado é ignorado. */
export async function atualizarServicoOS(
  id: string,
  servicoCodigo: string,
  patch: OSItemPatchInput,
  usuario: AuthenticatedUser,
  ctx: RequestContext = {},
  itemId?: number,
): Promise<OperationalOSDTO | AdminOSDTO> {
  const atual = await getOSOrThrow(id);
  assertNaoFinalizada(atual);
  const correspondentes = atual.servicos.filter((s) => s.servicoCodigo === servicoCodigo);
  if (itemId === undefined && correspondentes.length > 1)
    throw new ValidationError('Selecione a linha do serviço.');
  const item = correspondentes.find((s) => itemId === undefined || s.itemId === itemId);
  if (!item) {
    throw new NotFoundError('Serviço não encontrado nesta OS.', 'OS_ITEM_NOT_FOUND');
  }

  const precoUnitario = usuario.permissions.includes('FINANCIAL_EDIT')
    ? patch.precoUnitario
    : undefined;
  await osRepository.atualizarItemServico(id, servicoCodigo, {
    itemId,
    quantidade: patch.quantidade,
    precoUnitario,
    descricaoComplementar: patch.descricaoComplementar,
  });

  const atualizado = await osRepository.atualizar(id, {
    historico: [
      ...atual.historico,
      historicoEntry(`Serviço atualizado: ${item.descricao}`, usuario),
    ],
    cherpUsuarioChave: usuario.cherpUsuarioChave,
  });

  await auditOS('OS_SERVICE_UPDATED', id, usuario, ctx, { before: item, after: patch });

  return toOSDTO(atualizado, usuario.permissions);
}

export interface OSImagemDTO {
  identificador: string;
  descricao: string;
  nomeArquivo: string;
  data: string;
}

const MAX_IMAGEM_BYTES = 8 * 1024 * 1024;

/** Fotos da OS — gravadas em ORDEMSERVICOIMG (BLOB nativo do CHERP), nunca num armazenamento paralelo. */
export async function listarImagensOS(id: string): Promise<OSImagemDTO[]> {
  await getOSOrThrow(id);
  return osRepository.listarImagens(id);
}

export async function adicionarImagemOS(
  id: string,
  arquivo: { buffer: Buffer; nomeArquivo: string; descricao?: string },
  usuario: AuthenticatedUser,
  ctx: RequestContext = {},
): Promise<OSImagemDTO[]> {
  const atual = await getOSOrThrow(id);
  assertNaoFinalizada(atual);

  if (arquivo.buffer.length === 0 || arquivo.buffer.length > MAX_IMAGEM_BYTES) {
    throw new ValidationError('A imagem deve ter no máximo 8 MB.');
  }
  const tipo = detectarTipoImagem(arquivo.buffer);
  if (!tipo) {
    throw new ValidationError('Formato de imagem não permitido. Envie PNG, JPEG ou WebP.');
  }

  await osRepository.adicionarImagem(id, arquivo);
  await auditOS('OS_IMAGE_ADDED', id, usuario, ctx, { nomeArquivo: arquivo.nomeArquivo });

  return osRepository.listarImagens(id);
}

export async function removerImagemOS(
  id: string,
  identificador: string,
  usuario: AuthenticatedUser,
  ctx: RequestContext = {},
): Promise<OSImagemDTO[]> {
  const atual = await getOSOrThrow(id);
  assertNaoFinalizada(atual);

  await osRepository.removerImagem(id, identificador);
  await auditOS('OS_IMAGE_REMOVED', id, usuario, ctx, { identificador });

  return osRepository.listarImagens(id);
}

export async function buscarImagemOS(
  id: string,
  identificador: string,
): Promise<{ buffer: Buffer; nomeArquivo: string }> {
  await getOSOrThrow(id);
  const imagem = await osRepository.buscarImagem(id, identificador);
  if (!imagem) {
    throw new NotFoundError('Imagem não encontrada nesta OS.', 'OS_IMAGE_NOT_FOUND');
  }
  return imagem;
}
