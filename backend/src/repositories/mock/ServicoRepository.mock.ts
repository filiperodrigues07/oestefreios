import type { PaginatedResult, SearchQuery, Servico } from '../../types/cherp.types.js';
import { sortByField } from '../../utils/sortItems.js';
import type { IServicoRepository } from '../interfaces/IServicoRepository.js';

/**
 * MOCK — dados em memória, não vem do Firebird/CHERP.
 * TODO(Fase 5): substituir por implementação real contra o Firebird, mantendo esta mesma interface.
 */
const SERVICOS: Servico[] = [
  { codigo: '5012', descricao: 'Troca de óleo', unidade: 'SERV', tipoServicoCodigo: '140101', tipoServicoDescricao: 'Manutenção de veículos', valorUnitario: 80 },
  { codigo: '5013', descricao: 'Alinhamento e balanceamento', unidade: 'SERV', tipoServicoCodigo: '140101', tipoServicoDescricao: 'Manutenção de veículos', valorUnitario: 120 },
  { codigo: '5014', descricao: 'Troca de pastilha de freio', unidade: 'SERV', tipoServicoCodigo: '140101', tipoServicoDescricao: 'Manutenção de veículos', valorUnitario: 150 },
  { codigo: '5015', descricao: 'Revisão completa', unidade: 'SERV', tipoServicoCodigo: '140101', tipoServicoDescricao: 'Manutenção de veículos', valorUnitario: 350 },
  { codigo: '5016', descricao: 'Troca de correia dentada', unidade: 'SERV', tipoServicoCodigo: '140101', tipoServicoDescricao: 'Manutenção de veículos', valorUnitario: 280 },
  { codigo: '5017', descricao: 'Troca de amortecedor', unidade: 'SERV', tipoServicoCodigo: '140101', tipoServicoDescricao: 'Manutenção de veículos', valorUnitario: 180 },
  { codigo: '5018', descricao: 'Troca de bateria', unidade: 'SERV', tipoServicoCodigo: '140101', tipoServicoDescricao: 'Manutenção de veículos', valorUnitario: 40 },
  { codigo: '5019', descricao: 'Diagnóstico eletrônico', unidade: 'SERV', tipoServicoCodigo: '140201', tipoServicoDescricao: 'Assistência técnica', valorUnitario: 90 },
  { codigo: '5020', descricao: 'Troca de disco de freio', unidade: 'SERV', tipoServicoCodigo: '140101', tipoServicoDescricao: 'Manutenção de veículos', valorUnitario: 160 },
  { codigo: '5021', descricao: 'Higienização do ar-condicionado', unidade: 'SERV', tipoServicoCodigo: '140101', tipoServicoDescricao: 'Manutenção de veículos', valorUnitario: 110 },
];

export class ServicoRepositoryMock implements IServicoRepository {
  async listarTipos(): Promise<{ codigo: string; descricao: string }[]> {
    return [...new Map(SERVICOS.filter((s) => s.tipoServicoCodigo).map((s) => [s.tipoServicoCodigo!, {
      codigo: s.tipoServicoCodigo!, descricao: s.tipoServicoDescricao ?? s.tipoServicoCodigo!,
    }])).values()];
  }

  async buscarPorCodigo(codigo: string): Promise<Servico | null> {
    return SERVICOS.find((s) => s.codigo === codigo) ?? null;
  }

  async buscarPorDescricao(descricao: string): Promise<Servico[]> {
    const termo = descricao.toLowerCase();
    return SERVICOS.filter((s) => s.descricao.toLowerCase().includes(termo));
  }

  async buscar(query: SearchQuery): Promise<PaginatedResult<Servico>> {
    let filtered = SERVICOS;
    if (query.tipoServicoCodigo) {
      filtered = filtered.filter((s) => s.tipoServicoCodigo === query.tipoServicoCodigo);
    }
    if (query.codigo) {
      filtered = filtered.filter((s) => s.codigo === query.codigo);
    } else if (query.descricao) {
      const termo = query.descricao.toLowerCase();
      filtered = filtered.filter((s) => s.descricao.toLowerCase().includes(termo));
    }

    const sortBy = query.sortBy === 'codigo' ? 'codigo' : 'descricao';
    filtered = sortByField(filtered, sortBy, query.sortOrder ?? 'asc', (item, field) => item[field]);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const start = (page - 1) * limit;
    return { items: filtered.slice(start, start + limit), page, limit, total: filtered.length };
  }
}
