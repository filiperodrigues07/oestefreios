import type { Cliente, ClienteInput, PaginatedResult, SearchQuery, VinculosCadastro } from '../../types/cherp.types.js';
import { temVinculos } from '../../utils/vinculos.js';
import type { IClienteRepository } from '../interfaces/IClienteRepository.js';

/**
 * MOCK — dados em memória, não vem do Firebird/CHERP.
 * TODO(Fase 5): substituir por implementação real contra o Firebird, mantendo esta mesma interface.
 */
const CLIENTES: Cliente[] = [
  { codigo: '000001', nome: 'João da Silva', documento: '123.456.789-00', telefone: '(11) 91234-5678', tipoPessoa: 'PF' },
  {
    codigo: '000002',
    nome: 'Transportadora Boa Viagem LTDA',
    documento: '12.345.678/0001-90',
    telefone: '(11) 3344-5566',
    tipoPessoa: 'PJ',
  },
  { codigo: '000003', nome: 'Maria Oliveira', documento: '987.654.321-00', telefone: '(11) 99876-5432', tipoPessoa: 'PF' },
];

let proximoCodigo = 4;

export class ClienteRepositoryMock implements IClienteRepository {
  async buscarPorCodigo(codigo: string): Promise<Cliente | null> {
    return CLIENTES.find((c) => c.codigo === codigo) ?? null;
  }

  async buscarPorNome(nome: string): Promise<Cliente[]> {
    const termo = nome.toLowerCase();
    return CLIENTES.filter((c) => c.nome.toLowerCase().includes(termo));
  }

  async buscarPorDocumento(documento: string): Promise<Cliente | null> {
    const digitos = documento.replace(/\D/g, '');
    return CLIENTES.find((c) => c.documento?.replace(/\D/g, '') === digitos) ?? null;
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

  async criar(input: ClienteInput): Promise<Cliente> {
    const cliente: Cliente = { ...input, codigo: String(proximoCodigo++).padStart(6, '0') };
    CLIENTES.push(cliente);
    return cliente;
  }

  async atualizar(codigo: string, input: ClienteInput): Promise<Cliente> {
    const idx = CLIENTES.findIndex((c) => c.codigo === codigo);
    if (idx === -1) throw new Error('Cliente não encontrado.');
    const atualizado: Cliente = { ...CLIENTES[idx]!, ...input, codigo };
    CLIENTES[idx] = atualizado;
    return atualizado;
  }

  async excluir(codigo: string): Promise<boolean> {
    const idx = CLIENTES.findIndex((c) => c.codigo === codigo);
    if (idx === -1) return false;
    if (temVinculos(await this.contarVinculos(codigo))) return false;
    CLIENTES.splice(idx, 1);
    return true;
  }

  async contarVinculos(codigo: string): Promise<VinculosCadastro> {
    // Import tardio: o mock de veículo já importa este arquivo.
    const { EquipamentoRepositoryMock } = await import('./EquipamentoRepository.mock.js');
    const { OSRepositoryMock } = await import('./OSRepository.mock.js');
    const veiculos = await new EquipamentoRepositoryMock().buscarPorCliente(codigo);
    const os = (await new OSRepositoryMock().listarCabecalhos()).filter((item) => item.clienteCodigo === codigo);
    return { os: os.length, veiculos: veiculos.length, financeiro: 0, fiscal: 0, pedidos: 0, outros: 0 };
  }
}
