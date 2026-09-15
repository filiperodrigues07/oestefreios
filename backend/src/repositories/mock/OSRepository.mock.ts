import { randomUUID } from 'node:crypto';
import type { OrdemServico, OSItemProduto, OSItemServico, OSPrioridade, OSStatus } from '../../types/cherp.types.js';
import type { IOSRepository, OSListFilter } from '../interfaces/IOSRepository.js';

/**
 * MOCK — dados em memória, não vem do Firebird/CHERP.
 * TODO(Fase 5): substituir por implementação real contra o Firebird, mantendo esta mesma interface.
 * Construir entradas de `historico` é responsabilidade do service (services/os.service.ts),
 * não deste repositório — aqui só persistimos o que for passado.
 */

function horasAtras(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

function item(produto: Omit<OSItemProduto, 'total'>): OSItemProduto {
  return { ...produto, total: produto.precoUnitario !== undefined ? produto.precoUnitario * produto.quantidade : undefined };
}

function servicoItem(servico: Omit<OSItemServico, 'total'>): OSItemServico {
  return { ...servico, total: servico.valorUnitario !== undefined ? servico.valorUnitario * servico.quantidade : undefined };
}

interface SeedOSInput {
  numero: number;
  clienteCodigo: string;
  equipamentoCodigo: string;
  status: OSStatus;
  prioridade: OSPrioridade;
  problema: string;
  abertaHaHoras: number;
  concluidaHaHoras?: number;
  produtos?: OSItemProduto[];
  servicos?: OSItemServico[];
}

function seedOS(input: SeedOSInput): OrdemServico {
  const dataAbertura = horasAtras(input.abertaHaHoras);
  const produtos = input.produtos ?? [];
  const servicos = input.servicos ?? [];
  const totais = [...produtos.map((p) => p.total), ...servicos.map((s) => s.total)];
  const faturamento = totais.some((t) => t === undefined)
    ? undefined
    : totais.reduce<number>((acc, t) => acc + (t ?? 0), 0);

  return {
    id: randomUUID(),
    numero: input.numero,
    clienteCodigo: input.clienteCodigo,
    equipamentoCodigo: input.equipamentoCodigo,
    status: input.status,
    prioridade: input.prioridade,
    problema: input.problema,
    produtos,
    servicos,
    historico: [{ timestamp: dataAbertura, evento: 'OS criada', usuarioNome: 'Atendente (dev)' }],
    dataAbertura,
    dataConclusao: input.concluidaHaHoras !== undefined ? horasAtras(input.concluidaHaHoras) : undefined,
    faturamento,
  };
}

const OS_LIST: OrdemServico[] = [
  seedOS({
    numero: 1234,
    clienteCodigo: '000001',
    equipamentoCodigo: 'EQ01',
    status: 'EM_ANDAMENTO',
    prioridade: 'NORMAL',
    problema: 'Barulho estranho no motor ao acelerar',
    abertaHaHoras: 6,
    produtos: [item({ produtoCodigo: '00012349', descricao: 'Correia dentada', unidade: 'UN', quantidade: 1, precoUnitario: 180, desconto: 0 })],
    servicos: [servicoItem({ servicoCodigo: '5016', descricao: 'Troca de correia dentada', unidade: 'SERV', quantidade: 1, valorUnitario: 280, desconto: 0 })],
  }),
  seedOS({
    numero: 1230,
    clienteCodigo: '000002',
    equipamentoCodigo: 'EQ02',
    status: 'CONCLUIDA',
    prioridade: 'ALTA',
    problema: 'Freio traseiro raspando',
    abertaHaHoras: 72,
    concluidaHaHoras: 48,
    produtos: [item({ produtoCodigo: '00012350', descricao: 'Pastilha de freio traseira', unidade: 'JG', quantidade: 1, precoUnitario: 190, desconto: 0 })],
    servicos: [servicoItem({ servicoCodigo: '5014', descricao: 'Troca de pastilha de freio', unidade: 'SERV', quantidade: 1, valorUnitario: 150, desconto: 0 })],
  }),
  seedOS({
    numero: 1231,
    clienteCodigo: '000001',
    equipamentoCodigo: 'EQ01',
    status: 'CONCLUIDA',
    prioridade: 'NORMAL',
    problema: 'Revisão dos 20.000km',
    abertaHaHoras: 120,
    concluidaHaHoras: 96,
    produtos: [item({ produtoCodigo: '00012345', descricao: 'Filtro de óleo', unidade: 'UN', quantidade: 1, precoUnitario: 50, desconto: 0 })],
    servicos: [servicoItem({ servicoCodigo: '5015', descricao: 'Revisão completa', unidade: 'SERV', quantidade: 1, valorUnitario: 350, desconto: 0 })],
  }),
  seedOS({
    numero: 1232,
    clienteCodigo: '000003',
    equipamentoCodigo: 'EQ03',
    status: 'ABERTA',
    prioridade: 'URGENTE',
    problema: 'Carro não liga',
    abertaHaHoras: 1,
  }),
  seedOS({
    numero: 1233,
    clienteCodigo: '000002',
    equipamentoCodigo: 'EQ02',
    status: 'AGUARDANDO_PECA',
    prioridade: 'ALTA',
    problema: 'Amortecedor dianteiro vazando',
    abertaHaHoras: 30,
    produtos: [item({ produtoCodigo: '00012351', descricao: 'Amortecedor dianteiro', unidade: 'UN', quantidade: 2, precoUnitario: 320, desconto: 0 })],
  }),
  seedOS({
    numero: 1229,
    clienteCodigo: '000003',
    equipamentoCodigo: 'EQ03',
    status: 'CANCELADA',
    prioridade: 'BAIXA',
    problema: 'Ruído no painel — cliente desistiu',
    abertaHaHoras: 200,
  }),
  seedOS({
    numero: 1235,
    clienteCodigo: '000001',
    equipamentoCodigo: 'EQ01',
    status: 'EM_ANALISE',
    prioridade: 'NORMAL',
    problema: 'Consumo de combustível acima do normal',
    abertaHaHoras: 3,
  }),
];

let nextNumero = 1236;

export class OSRepositoryMock implements IOSRepository {
  async buscarPorId(id: string): Promise<OrdemServico | null> {
    return OS_LIST.find((os) => os.id === id) ?? null;
  }

  async listar(filter: OSListFilter): Promise<{ items: OrdemServico[]; total: number }> {
    let filtered = OS_LIST;
    if (filter.status) {
      filtered = filtered.filter((os) => os.status === filter.status);
    }
    if (filter.clienteCodigo) {
      filtered = filtered.filter((os) => os.clienteCodigo === filter.clienteCodigo);
    }
    if (filter.tecnicoId) {
      filtered = filtered.filter((os) => os.tecnicoId === filter.tecnicoId);
    }
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const start = (page - 1) * limit;
    return { items: filtered.slice(start, start + limit), total: filtered.length };
  }

  async criar(os: Omit<OrdemServico, 'id' | 'numero'>): Promise<OrdemServico> {
    const novo: OrdemServico = { ...os, id: randomUUID(), numero: nextNumero++ };
    OS_LIST.push(novo);
    return novo;
  }

  async atualizar(id: string, patch: Partial<OrdemServico>): Promise<OrdemServico> {
    const idx = OS_LIST.findIndex((os) => os.id === id);
    if (idx === -1) {
      throw new Error('OS não encontrada.');
    }
    const atual = OS_LIST[idx]!;
    const atualizado: OrdemServico = { ...atual, ...patch };
    OS_LIST[idx] = atualizado;
    return atualizado;
  }
}
