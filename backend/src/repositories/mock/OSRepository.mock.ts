import { randomUUID } from 'node:crypto';
import type { OrdemServico, OSItemProduto, OSItemServico, OSPrioridade, OSStatus } from '../../types/cherp.types.js';
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

interface MockImagem {
  identificador: string;
  osId: string;
  descricao: string;
  nomeArquivo: string;
  buffer: Buffer;
  data: string;
}

const IMAGENS_MOCK: MockImagem[] = [];

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
  situacaoDocumento?: number;
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
    situacaoDocumento: input.situacaoDocumento ?? (input.status === 'CONCLUIDA' ? 1 : input.status === 'CANCELADA' ? 6 : 0),
    faturamento,
  };
}

const OS_LIST: OrdemServico[] = [
  seedOS({
    numero: 1234,
    clienteCodigo: '000001',
    equipamentoCodigo: 'EQ01',
    status: 'ABERTA',
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
    status: 'ABERTA',
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

  /** Espelha a regra da implementação real: só OS em aberto (nunca concluída/cancelada) — ver OSRepository.firebird.ts. */
  async listar(filter: OSListFilter): Promise<{ items: OrdemServico[]; total: number }> {
    let filtered = filter.incluirFinalizadas
      ? [...OS_LIST]
      : OS_LIST.filter((os) => os.status !== 'CONCLUIDA' && os.status !== 'CANCELADA');
    if (filter.status === 'AGUARDANDO') {
      filtered = filtered.filter((os) => os.status === 'AGUARDANDO_PECA' || os.status === 'AGUARDANDO_CLIENTE');
    } else if (filter.status) {
      filtered = filtered.filter((os) => os.status === filter.status);
    }
    if (filter.situacaoDocumento !== undefined) {
      filtered = filtered.filter((os) => os.situacaoDocumento === filter.situacaoDocumento);
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

  async listarParaDashboard(filter: OSDashboardFilter): Promise<OrdemServico[]> {
    const inicio = filter.dataInicial.getTime();
    const fim = filter.dataFinal.getTime();
    return OS_LIST.filter((os) => {
      const abertaNoPeriodo = new Date(os.dataAbertura).getTime();
      const concluidaNoPeriodo = os.dataConclusao ? new Date(os.dataConclusao).getTime() : NaN;
      return (abertaNoPeriodo >= inicio && abertaNoPeriodo <= fim) || (concluidaNoPeriodo >= inicio && concluidaNoPeriodo <= fim);
    });
  }

  async listarParaRelatorio(filter: OSReportFilter): Promise<OrdemServico[]> {
    const inicio = filter.dataInicial.getTime();
    const fim = filter.dataFinal.getTime();
    return OS_LIST.filter((os) => {
      const data = filter.dataReferencia === 'conclusao' ? os.dataConclusao : os.dataAbertura;
      if (!data) return false;
      const timestamp = new Date(data).getTime();
      return timestamp >= inicio && timestamp <= fim && (filter.situacaoDocumento === undefined || os.situacaoDocumento === filter.situacaoDocumento);
    });
  }

  async buscarParaDashboard(termo: string): Promise<OrdemServico[]> {
    const needle = termo.toLocaleLowerCase('pt-BR');
    return OS_LIST.filter((os) => [String(os.numero), os.clienteNome, os.clienteCodigo, os.equipamentoDescricao, os.equipamentoCodigo].some((value) => value?.toLocaleLowerCase('pt-BR').includes(needle))).slice(0, 8);
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

  async atualizarItemProduto(id: string, produtoCodigo: string, patch: OSItemPatch): Promise<OrdemServico> {
    const os = OS_LIST.find((o) => o.id === id);
    if (!os) throw new Error('OS não encontrada.');
    const item = os.produtos.find((p) => p.produtoCodigo === produtoCodigo);
    if (!item) throw new Error('Item não encontrado.');
    if (patch.quantidade !== undefined) item.quantidade = patch.quantidade;
    if (patch.precoUnitario !== undefined) item.precoUnitario = patch.precoUnitario;
    if (patch.descricaoComplementar !== undefined) item.descricaoComplementar = patch.descricaoComplementar;
    item.total = item.quantidade * (item.precoUnitario ?? 0);
    return os;
  }

  async atualizarItemServico(id: string, servicoCodigo: string, patch: OSItemPatch): Promise<OrdemServico> {
    const os = OS_LIST.find((o) => o.id === id);
    if (!os) throw new Error('OS não encontrada.');
    const item = os.servicos.find((s) => s.servicoCodigo === servicoCodigo);
    if (!item) throw new Error('Item não encontrado.');
    if (patch.quantidade !== undefined) item.quantidade = patch.quantidade;
    if (patch.precoUnitario !== undefined) item.valorUnitario = patch.precoUnitario;
    if (patch.descricaoComplementar !== undefined) item.descricaoComplementar = patch.descricaoComplementar;
    item.total = item.quantidade * (item.valorUnitario ?? 0);
    return os;
  }

  async listarImagens(id: string): Promise<OSImagemMeta[]> {
    return IMAGENS_MOCK.filter((img) => img.osId === id).map((img) => ({
      identificador: img.identificador,
      descricao: img.descricao,
      nomeArquivo: img.nomeArquivo,
      data: img.data,
    }));
  }

  async adicionarImagem(id: string, imagem: OSImagemNova): Promise<void> {
    IMAGENS_MOCK.push({
      identificador: randomUUID(),
      osId: id,
      descricao: imagem.descricao ?? imagem.nomeArquivo,
      nomeArquivo: imagem.nomeArquivo,
      buffer: imagem.buffer,
      data: new Date().toISOString(),
    });
  }

  async buscarImagem(id: string, identificador: string): Promise<OSImagemArquivo | null> {
    const img = IMAGENS_MOCK.find((i) => i.osId === id && i.identificador === identificador);
    return img ? { buffer: img.buffer, nomeArquivo: img.nomeArquivo } : null;
  }

  async removerImagem(id: string, identificador: string): Promise<void> {
    const idx = IMAGENS_MOCK.findIndex((i) => i.osId === id && i.identificador === identificador);
    if (idx !== -1) IMAGENS_MOCK.splice(idx, 1);
  }
}
