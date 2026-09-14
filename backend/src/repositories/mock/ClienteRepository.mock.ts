import type { Cliente, PaginatedResult, SearchQuery } from '../../types/cherp.types.js';
import type { IClienteRepository } from '../interfaces/IClienteRepository.js';

/**
 * MOCK — dados em memória, não vem do Firebird/CHERP.
 * TODO(Fase 5): substituir por implementação real contra o Firebird, mantendo esta mesma interface.
 */
const CLIENTES: Cliente[] = [
  { codigo: '000001', nome: 'João da Silva', documento: '123.456.789-00', telefone: '(11) 91234-5678' },
  { codigo: '000002', nome: 'Transportadora Boa Viagem LTDA', documento: '12.345.678/0001-90', telefone: '(11) 3344-5566' },
  { codigo: '000003', nome: 'Maria Oliveira', documento: '987.654.321-00', telefone: '(11) 99876-5432' },
];

export class ClienteRepositoryMock implements IClienteRepository {
  async buscarPorCodigo(codigo: string): Promise<Cliente | null> {
    return CLIENTES.find((c) => c.codigo === codigo) ?? null;
  }

  async buscarPorNome(nome: string): Promise<Cliente[]> {
    const termo = nome.toLowerCase();
    return CLIENTES.filter((c) => c.nome.toLowerCase().includes(termo));
  }

  async buscar(query: SearchQuery): Promise<PaginatedResult<Cliente>> {
    let filtered = CLIENTES;
    if (query.codigo) {
      filtered = filtered.filter((c) => c.codigo === query.codigo);
    } else if (query.descricao) {
      const termo = query.descricao.toLowerCase();
      filtered = filtered.filter((c) => c.nome.toLowerCase().includes(termo));
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const start = (page - 1) * limit;
    return { items: filtered.slice(start, start + limit), page, limit, total: filtered.length };
  }
}
