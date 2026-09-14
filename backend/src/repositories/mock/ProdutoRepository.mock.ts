import type { PaginatedResult, Produto, SearchQuery } from '../../types/cherp.types.js';
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
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const start = (page - 1) * limit;
    return { items: filtered.slice(start, start + limit), page, limit, total: filtered.length };
  }
}
