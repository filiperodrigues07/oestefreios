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
import { recordAudit } from './auditLog.service.js';
import { assertValidTransition } from './osWorkflow.js';

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

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
  });

  await auditOS('OS_CREATED', novo.id, usuario, ctx, { after: input });

  return toOSDTO(novo, usuario.permissions);
}

interface AtualizarOSInput {
  diagnostico?: string;
  observacoes?: string;
  solucao?: string;
  prioridade?: OSPrioridade;
  responsavelId?: string;
  tecnicoId?: string;
  dataPrevista?: string;
}

export async function atualizarOS(
  id: string,
  patch: AtualizarOSInput,
  usuario: AuthenticatedUser,
  ctx: RequestContext = {},
): Promise<OperationalOSDTO | AdminOSDTO> {
  const atual = await getOSOrThrow(id);

  const camposAlterados = Object.keys(patch).filter(
    (key) => patch[key as keyof AtualizarOSInput] !== undefined,
  ) as (keyof AtualizarOSInput)[];

  const atualizado = await osRepository.atualizar(id, {
    ...patch,
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
  assertValidTransition(atual.status, novoStatus);

  const patch: Partial<OrdemServico> = {
    status: novoStatus,
    historico: [...atual.historico, historicoEntry(`Status alterado para "${novoStatus}"`, usuario)],
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
): Promise<OperationalOSDTO | AdminOSDTO> {
  const atual = await getOSOrThrow(id);
  const produto = await produtoRepository.buscarPorCodigo(produtoCodigo);
  if (!produto) {
    throw new ValidationError(`Produto com código "${produtoCodigo}" não encontrado.`);
  }

  const jaExiste = atual.produtos.some((p) => p.produtoCodigo === produtoCodigo);
  if (jaExiste) {
    throw new ValidationError('Produto já adicionado a esta OS. Ajuste a quantidade em vez de adicionar de novo.');
  }

  const precoUnitario = produto.precoUnitario;
  const total = precoUnitario !== undefined ? precoUnitario * quantidade : undefined;
  const novoItem = {
    produtoCodigo: produto.codigo,
    descricao: produto.descricao,
    unidade: produto.unidade,
    quantidade,
    precoUnitario,
    desconto: 0,
    total,
  };
  const produtos = [...atual.produtos, novoItem];

  const atualizado = await osRepository.atualizar(id, {
    produtos,
    faturamento: calcularFaturamento(produtos, atual.servicos),
    historico: [...atual.historico, historicoEntry(`Produto adicionado: ${produto.descricao}`, usuario)],
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
  const item = atual.produtos.find((p) => p.produtoCodigo === produtoCodigo);
  if (!item) {
    throw new NotFoundError('Produto não encontrado nesta OS.', 'OS_ITEM_NOT_FOUND');
  }

  const produtos = atual.produtos.filter((p) => p.produtoCodigo !== produtoCodigo);
  const atualizado = await osRepository.atualizar(id, {
    produtos,
    faturamento: calcularFaturamento(produtos, atual.servicos),
    historico: [...atual.historico, historicoEntry(`Produto removido: ${item.descricao}`, usuario)],
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
): Promise<OperationalOSDTO | AdminOSDTO> {
  const atual = await getOSOrThrow(id);
  const servico = await servicoRepository.buscarPorCodigo(servicoCodigo);
  if (!servico) {
    throw new ValidationError(`Serviço com código "${servicoCodigo}" não encontrado.`);
  }

  const jaExiste = atual.servicos.some((s) => s.servicoCodigo === servicoCodigo);
  if (jaExiste) {
    throw new ValidationError('Serviço já adicionado a esta OS.');
  }

  const valorUnitario = servico.valorUnitario;
  const total = valorUnitario !== undefined ? valorUnitario * quantidade : undefined;
  const novoItem = {
    servicoCodigo: servico.codigo,
    descricao: servico.descricao,
    unidade: servico.unidade,
    quantidade,
    valorUnitario,
    desconto: 0,
    total,
  };
  const servicos = [...atual.servicos, novoItem];

  const atualizado = await osRepository.atualizar(id, {
    servicos,
    faturamento: calcularFaturamento(atual.produtos, servicos),
    historico: [...atual.historico, historicoEntry(`Serviço adicionado: ${servico.descricao}`, usuario)],
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
  const item = atual.servicos.find((s) => s.servicoCodigo === servicoCodigo);
  if (!item) {
    throw new NotFoundError('Serviço não encontrado nesta OS.', 'OS_ITEM_NOT_FOUND');
  }

  const servicos = atual.servicos.filter((s) => s.servicoCodigo !== servicoCodigo);
  const atualizado = await osRepository.atualizar(id, {
    servicos,
    faturamento: calcularFaturamento(atual.produtos, servicos),
    historico: [...atual.historico, historicoEntry(`Serviço removido: ${item.descricao}`, usuario)],
  });

  await auditOS('OS_SERVICE_REMOVED', id, usuario, ctx, { before: item });

  return toOSDTO(atualizado, usuario.permissions);
}
