import { randomUUID } from 'node:crypto';
import type { OrdemServico } from '../../types/cherp.types.js';
import type { IOSRepository, OSListFilter } from '../interfaces/IOSRepository.js';

/**
 * MOCK — dados em memória, não vem do Firebird/CHERP.
 * TODO(Fase 5): substituir por implementação real contra o Firebird, mantendo esta mesma interface.
 */
const OS_LIST: OrdemServico[] = [
  {
    id: randomUUID(),
    numero: 1234,
    clienteCodigo: '000001',
    equipamentoCodigo: 'EQ01',
    status: 'EM_ANDAMENTO',
    prioridade: 'NORMAL',
    problema: 'Barulho estranho no motor ao acelerar',
    diagnostico: 'Correia dentada desgastada',
    produtos: [
      {
        produtoCodigo: '00012349',
        descricao: 'Correia dentada',
        unidade: 'UN',
        quantidade: 1,
        precoUnitario: 180,
        desconto: 0,
        total: 180,
      },
    ],
    servicos: [
      {
        servicoCodigo: '5016',
        descricao: 'Troca de correia dentada',
        unidade: 'SERV',
        quantidade: 1,
        valorUnitario: 280,
        total: 280,
      },
    ],
    dataAbertura: new Date().toISOString(),
    faturamento: 460,
  },
];

let nextNumero = 1235;

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
