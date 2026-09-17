import type { PaginatedResult, Produto, SearchQuery } from '../../types/cherp.types.js';
import { sortByField } from '../../utils/sortItems.js';
import type { IProdutoRepository } from '../interfaces/IProdutoRepository.js';

/**
 * MOCK — dados em memória, não vem do Firebird/CHERP.
 * TODO(Fase 5): substituir por implementação real contra o Firebird, mantendo esta mesma interface.
 */
const PRODUTOS: Produto[] = [
  { codigo: '00012345', descricao: 'Filtro de óleo', unidade: 'UN', disponivel: 42, precoUnitario: 50, custo: 30 },
  { codigo: '00012346', descricao: 'Filtro de ar', unidade: 'UN', disponivel: 18, precoUnitario: 65, custo: 38 },
  { codigo: '00012347', descricao: 'Pastilha de freio dianteira', unidade: 'JG', disponivel: 12, precoUnitario: 220, custo: 140 },
  { codigo: '00012348', descricao: 'Óleo motor 15W40 (litro)', unidade: 'L', disponivel: 300, precoUnitario: 32, custo: 21 },
  { codigo: '00012349', descricao: 'Correia dentada', unidade: 'UN', disponivel: 7, precoUnitario: 180, custo: 110 },
  { codigo: '00012350', descricao: 'Pastilha de freio traseira', unidade: 'JG', disponivel: 15, precoUnitario: 190, custo: 120 },
  { codigo: '00012351', descricao: 'Amortecedor dianteiro', unidade: 'UN', disponivel: 6, precoUnitario: 320, custo: 210 },
  { codigo: '00012352', descricao: 'Amortecedor traseiro', unidade: 'UN', disponivel: 6, precoUnitario: 290, custo: 190 },
  { codigo: '00012353', descricao: 'Vela de ignição', unidade: 'UN', disponivel: 60, precoUnitario: 28, custo: 16 },
  { codigo: '00012354', descricao: 'Bateria 60Ah', unidade: 'UN', disponivel: 9, precoUnitario: 480, custo: 340 },
  { codigo: '00012355', descricao: 'Disco de freio dianteiro', unidade: 'UN', disponivel: 10, precoUnitario: 210, custo: 130 },
  { codigo: '00012356', descricao: 'Óleo de câmbio (litro)', unidade: 'L', disponivel: 120, precoUnitario: 45, custo: 29 },
  { codigo: '00012357', descricao: 'Filtro de combustível', unidade: 'UN', disponivel: 25, precoUnitario: 38, custo: 22 },
  { codigo: '00012358', descricao: 'Correia do alternador', unidade: 'UN', disponivel: 14, precoUnitario: 75, custo: 46 },
];

export class ProdutoRepositoryMock implements IProdutoRepository {
  async buscarPorCodigo(codigo: string): Promise<Produto | null> {
    return PRODUTOS.find((p) => p.codigo === codigo) ?? null;
  }

  async buscarPorDescricao(descricao: string): Promise<Produto[]> {
    const termo = descricao.toLowerCase();
    return PRODUTOS.filter((p) => p.descricao.toLowerCase().includes(termo));
  }

  async buscar(query: SearchQuery): Promise<PaginatedResult<Produto>> {
    let filtered = PRODUTOS;
    if (query.codigo) {
      filtered = filtered.filter((p) => p.codigo === query.codigo);
    } else if (query.descricao) {
      const termo = query.descricao.toLowerCase();
      filtered = filtered.filter((p) => p.descricao.toLowerCase().includes(termo));
    }

    const sortBy = query.sortBy === 'codigo' ? 'codigo' : 'descricao';
    filtered = sortByField(filtered, sortBy, query.sortOrder ?? 'asc', (item, field) => item[field]);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const start = (page - 1) * limit;
    return { items: filtered.slice(start, start + limit), page, limit, total: filtered.length };
  }
}
