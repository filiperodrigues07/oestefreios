import type { PaginatedResult, SearchQuery, Servico } from '../../types/cherp.types.js';
import { sortByField } from '../../utils/sortItems.js';
import type { IServicoRepository } from '../interfaces/IServicoRepository.js';

/**
 * MOCK — dados em memória, não vem do Firebird/CHERP.
 * TODO(Fase 5): substituir por implementação real contra o Firebird, mantendo esta mesma interface.
 */
const SERVICOS: Servico[] = [
  { codigo: '5012', descricao: 'Troca de óleo', unidade: 'SERV', valorUnitario: 80 },
  { codigo: '5013', descricao: 'Alinhamento e balanceamento', unidade: 'SERV', valorUnitario: 120 },
  { codigo: '5014', descricao: 'Troca de pastilha de freio', unidade: 'SERV', valorUnitario: 150 },
  { codigo: '5015', descricao: 'Revisão completa', unidade: 'SERV', valorUnitario: 350 },
  { codigo: '5016', descricao: 'Troca de correia dentada', unidade: 'SERV', valorUnitario: 280 },
  { codigo: '5017', descricao: 'Troca de amortecedor', unidade: 'SERV', valorUnitario: 180 },
  { codigo: '5018', descricao: 'Troca de bateria', unidade: 'SERV', valorUnitario: 40 },
  { codigo: '5019', descricao: 'Diagnóstico eletrônico', unidade: 'SERV', valorUnitario: 90 },
  { codigo: '5020', descricao: 'Troca de disco de freio', unidade: 'SERV', valorUnitario: 160 },
  { codigo: '5021', descricao: 'Higienização do ar-condicionado', unidade: 'SERV', valorUnitario: 110 },
];

export class ServicoRepositoryMock implements IServicoRepository {
  async buscarPorCodigo(codigo: string): Promise<Servico | null> {
    return SERVICOS.find((s) => s.codigo === codigo) ?? null;
  }

  async buscarPorDescricao(descricao: string): Promise<Servico[]> {
    const termo = descricao.toLowerCase();
    return SERVICOS.filter((s) => s.descricao.toLowerCase().includes(termo));
  }

  async buscar(query: SearchQuery): Promise<PaginatedResult<Servico>> {
    let filtered = SERVICOS;
    if (query.codigo) {
      filtered = filtered.filter((s) => s.codigo === query.codigo);
    } else if (query.descricao) {
      const termo = query.descricao.toLowerCase();
      filtered = filtered.filter((s) => s.descricao.toLowerCase().includes(termo));
    }

    filtered = sortByField(filtered, query.sortBy ?? 'descricao', query.sortOrder ?? 'asc', (item, field) => item[field]);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const start = (page - 1) * limit;
    return { items: filtered.slice(start, start + limit), page, limit, total: filtered.length };
  }
}
