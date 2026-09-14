import type { Equipamento, PaginatedResult, SearchQuery } from '../../types/cherp.types.js';
import type { IEquipamentoRepository } from '../interfaces/IEquipamentoRepository.js';

/**
 * MOCK — dados em memória, não vem do Firebird/CHERP.
 * TODO(Fase 5): substituir por implementação real contra o Firebird, mantendo esta mesma interface.
 */
const EQUIPAMENTOS: Equipamento[] = [
  { codigo: 'EQ01', descricao: 'Caminhão ABC', clienteCodigo: '000001', identificacao: 'Placa ABC-1234' },
  { codigo: 'EQ02', descricao: 'Van de Entrega', clienteCodigo: '000002', identificacao: 'Placa DEF-5678' },
  { codigo: 'EQ03', descricao: 'Carreta Graneleira', clienteCodigo: '000002', identificacao: 'Placa GHI-9012' },
];

export class EquipamentoRepositoryMock implements IEquipamentoRepository {
  async buscarPorCodigo(codigo: string): Promise<Equipamento | null> {
    return EQUIPAMENTOS.find((e) => e.codigo === codigo) ?? null;
  }

  async buscarPorCliente(clienteCodigo: string): Promise<Equipamento[]> {
    return EQUIPAMENTOS.filter((e) => e.clienteCodigo === clienteCodigo);
  }

  async buscar(query: SearchQuery): Promise<PaginatedResult<Equipamento>> {
    let filtered = EQUIPAMENTOS;
    if (query.codigo) {
      filtered = filtered.filter((e) => e.codigo === query.codigo);
    } else if (query.descricao) {
      const termo = query.descricao.toLowerCase();
      filtered = filtered.filter((e) => e.descricao.toLowerCase().includes(termo));
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const start = (page - 1) * limit;
    return { items: filtered.slice(start, start + limit), page, limit, total: filtered.length };
  }
}
