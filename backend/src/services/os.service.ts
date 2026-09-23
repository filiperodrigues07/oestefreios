import { toOSDTO } from '../dto/mappers/os.mapper.js';
import type { AdminOSDTO, OperationalOSDTO } from '../dto/os.dto.js';
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
import type { OrdemServico, OSHistoricoEntry, OSPrioridade, OSStatus } from '../types/cherp.types.js';
import { detectarTipoImagem } from '../utils/imageSignature.js';
import type { RequestContext } from '../utils/requestContext.js';
import { recordAudit } from './auditLog.service.js';
import { assertValidTransition } from './osWorkflow.js';

function historicoEntry(evento: string, usuario: AuthenticatedUser): OSHistoricoEntry {
  return { timestamp: new Date().toISOString(), evento, usuarioNome: usuario.name };
}

/** Auditoria de negócio (seção 24) — trilha durável e protegida, separada do histórico exibido na OS. */
function auditOS(event: string, osId: string, usuario: AuthenticatedUser, ctx: RequestContext, changes?: unknown) {
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
  if ((os.situacaoDocumento !== undefined && os.situacaoDocumento !== 0) || os.dataConclusao || os.travadoLocal) {
    throw new ValidationError('OS fechada ou com pedido/NF gerado no CHERP é somente consulta e não pode ser alterada.');
  }
}

export async function listOS(
  filter: OSListFilter,
  permissions: Permission[],
): Promise<{ items: (OperationalOSDTO | AdminOSDTO)[]; total: number }> {
  const result = await osRepository.listar(filter);
  return { items: result.items.map((os) => toOSDTO(os, permissions)), total: result.total };
}

export async function getOSById(id: string, permissions: Permission[]): Promise<OperationalOSDTO | AdminOSDTO> {
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
}

export async function criarOS(
  input: CriarOSInput,
  usuario: AuthenticatedUser,
  ctx: RequestContext = {},
): Promise<OperationalOSDTO | AdminOSDTO> {
  const cliente = await clienteRepository.buscarPorCodigo(input.clienteCodigo);
  if (!cliente) {
    throw new ValidationError(`Cliente com código "${input.clienteCodigo}" não encontrado.`);
  }
  const equipamento = await equipamentoRepository.buscarPorCodigo(input.equipamentoCodigo);
  if (!equipamento) {
    throw new ValidationError(`Equipamento com código "${input.equipamentoCodigo}" não encontrado.`);
  }
  if (equipamento.clienteCodigo !== input.clienteCodigo) {
    throw new ValidationError('O equipamento informado não pertence ao cliente informado.');
  }

  const novo = await osRepository.criar({
    clienteCodigo: input.clienteCodigo,
    equipamentoCodigo: input.equipamentoCodigo,
    problema: input.problema,
    prioridade: input.prioridade,
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
 * Cria uma OS nova a partir de outra (cabeçalho, itens e diagnóstico). Funciona mesmo com a
 * origem finalizada / com pedido gerado — a origem nunca é alterada, só lida. A OS nova nasce
 * aberta, com número e DAV próprios (gerados pelo `criar` do repositório) e sem fotos/histórico.
 */
export async function duplicarOS(
  id: string,
  usuario: AuthenticatedUser,
  ctx: RequestContext = {},
): Promise<OperationalOSDTO | AdminOSDTO> {
  const origem = await getOSOrThrow(id);

  const criada = await osRepository.criar({
    clienteCodigo: origem.clienteCodigo,
    equipamentoCodigo: origem.equipamentoCodigo,
    problema: origem.problema,
    prioridade: origem.prioridade,
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
    origem.observacoes !== undefined ||
    origem.solucao !== undefined ||
    origem.kmAtual !== undefined ||
    origem.kmFinal !== undefined;

  let nova = criada;
  if (temItens || temDiagnostico) {
    nova = await osRepository.atualizar(criada.id, {
      ...(temItens ? { produtos: origem.produtos, servicos: origem.servicos } : {}),
      ...(temItens ? { faturamento: calcularFaturamento(origem.produtos, origem.servicos) } : {}),
      diagnostico: origem.diagnostico,
      observacoes: origem.observacoes,
      solucao: origem.solucao,
      kmAtual: origem.kmAtual,
      kmFinal: origem.kmFinal,
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
  solucao?: string;
  prioridade?: OSPrioridade;
  responsavelId?: string;
  tecnicoId?: string;
  dataPrevista?: string;
  kmAtual?: number;
  kmFinal?: number;
}

export async function atualizarOS(
  id: string,
  patch: AtualizarOSInput,
  usuario: AuthenticatedUser,
  ctx: RequestContext = {},
): Promise<OperationalOSDTO | AdminOSDTO> {
  const atual = await getOSOrThrow(id);
  assertNaoFinalizada(atual);

  const camposAlterados = Object.keys(patch).filter(
    (key) => patch[key as keyof AtualizarOSInput] !== undefined,
  ) as (keyof AtualizarOSInput)[];

  const atualizado = await osRepository.atualizar(id, {
    ...patch,
    cherpUsuarioChave: usuario.cherpUsuarioChave,
    historico: [...atual.historico, historicoEntry(`OS atualizada (${camposAlterados.join(', ')})`, usuario)],
  });

  const before = Object.fromEntries(camposAlterados.map((k) => [k, atual[k]]));
  const after = Object.fromEntries(camposAlterados.map((k) => [k, patch[k]]));
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
    historico: [...atual.historico, historicoEntry(`Status alterado para "${novoStatus}"`, usuario)],
    cherpUsuarioChave: usuario.cherpUsuarioChave,
  };
  if (novoStatus === 'CONCLUIDA') {
    patch.dataConclusao = new Date().toISOString();
  }

  const atualizado = await osRepository.atualizar(id, patch);

  await auditOS('OS_STATUS_CHANGED', id, usuario, ctx, { before: atual.status, after: novoStatus });

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

  const jaExiste = atual.produtos.some((p) => p.produtoCodigo === produtoCodigo);
  if (jaExiste) {
    throw new ValidationError('Produto já adicionado a esta OS. Ajuste a quantidade em vez de adicionar de novo.');
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
    historico: [...atual.historico, historicoEntry(`Produto adicionado: ${produto.descricao}`, usuario)],
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
): Promise<OperationalOSDTO | AdminOSDTO> {
  const atual = await getOSOrThrow(id);
  assertNaoFinalizada(atual);
  const item = atual.produtos.find((p) => p.produtoCodigo === produtoCodigo);
  if (!item) {
    throw new NotFoundError('Produto não encontrado nesta OS.', 'OS_ITEM_NOT_FOUND');
  }

  const produtos = atual.produtos.filter((p) => p.produtoCodigo !== produtoCodigo);
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

  const jaExiste = atual.servicos.some((s) => s.servicoCodigo === servicoCodigo);
  if (jaExiste) {
    throw new ValidationError('Serviço já adicionado a esta OS.');
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
    historico: [...atual.historico, historicoEntry(`Serviço adicionado: ${servico.descricao}`, usuario)],
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
): Promise<OperationalOSDTO | AdminOSDTO> {
  const atual = await getOSOrThrow(id);
  assertNaoFinalizada(atual);
  const item = atual.servicos.find((s) => s.servicoCodigo === servicoCodigo);
  if (!item) {
    throw new NotFoundError('Serviço não encontrado nesta OS.', 'OS_ITEM_NOT_FOUND');
  }

  const servicos = atual.servicos.filter((s) => s.servicoCodigo !== servicoCodigo);
  const atualizado = await osRepository.atualizar(id, {
    servicos,
    faturamento: calcularFaturamento(atual.produtos, servicos),
    historico: [...atual.historico, historicoEntry(`Serviço removido: ${item.descricao}`, usuario)],
    cherpUsuarioChave: usuario.cherpUsuarioChave,
  });

  await auditOS('OS_SERVICE_REMOVED', id, usuario, ctx, { before: item });

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
): Promise<OperationalOSDTO | AdminOSDTO> {
  const atual = await getOSOrThrow(id);
  assertNaoFinalizada(atual);
  const item = atual.produtos.find((p) => p.produtoCodigo === produtoCodigo);
  if (!item) {
    throw new NotFoundError('Produto não encontrado nesta OS.', 'OS_ITEM_NOT_FOUND');
  }

  const precoUnitario = usuario.permissions.includes('FINANCIAL_EDIT') ? patch.precoUnitario : undefined;
  await osRepository.atualizarItemProduto(id, produtoCodigo, {
    quantidade: patch.quantidade,
    precoUnitario,
    descricaoComplementar: patch.descricaoComplementar,
  });

  const atualizado = await osRepository.atualizar(id, {
    historico: [...atual.historico, historicoEntry(`Produto atualizado: ${item.descricao}`, usuario)],
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
): Promise<OperationalOSDTO | AdminOSDTO> {
  const atual = await getOSOrThrow(id);
  assertNaoFinalizada(atual);
  const item = atual.servicos.find((s) => s.servicoCodigo === servicoCodigo);
  if (!item) {
    throw new NotFoundError('Serviço não encontrado nesta OS.', 'OS_ITEM_NOT_FOUND');
  }

  const precoUnitario = usuario.permissions.includes('FINANCIAL_EDIT') ? patch.precoUnitario : undefined;
  await osRepository.atualizarItemServico(id, servicoCodigo, {
    quantidade: patch.quantidade,
    precoUnitario,
    descricaoComplementar: patch.descricaoComplementar,
  });

  const atualizado = await osRepository.atualizar(id, {
    historico: [...atual.historico, historicoEntry(`Serviço atualizado: ${item.descricao}`, usuario)],
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

export async function buscarImagemOS(id: string, identificador: string): Promise<{ buffer: Buffer; nomeArquivo: string }> {
  await getOSOrThrow(id);
  const imagem = await osRepository.buscarImagem(id, identificador);
  if (!imagem) {
    throw new NotFoundError('Imagem não encontrada nesta OS.', 'OS_IMAGE_NOT_FOUND');
  }
  return imagem;
}
