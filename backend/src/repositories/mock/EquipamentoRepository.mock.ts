import type {
  Equipamento,
  EquipamentoInput,
  PaginatedResult,
  SearchQuery,
} from '../../types/cherp.types.js';
import type { IEquipamentoRepository } from '../interfaces/IEquipamentoRepository.js';
import { ClienteRepositoryMock } from './ClienteRepository.mock.js';

/**
 * MOCK — dados em memória, não vem do Firebird/CHERP.
 * TODO(Fase 5): substituir por implementação real contra o Firebird, mantendo esta mesma interface.
 */
const EQUIPAMENTOS: Equipamento[] = [
  { codigo: 'EQ01', descricao: 'Caminhão ABC', clienteCodigo: '000001', identificacao: 'ABC-1234' },
  {
    codigo: 'EQ02',
    descricao: 'Van de Entrega',
    clienteCodigo: '000002',
    identificacao: 'DEF-5678',
  },
  {
    codigo: 'EQ03',
    descricao: 'Carreta Graneleira',
    clienteCodigo: '000002',
    identificacao: 'GHI-9012',
  },
];

let proximoCodigo = 4;

export class EquipamentoRepositoryMock implements IEquipamentoRepository {
  async buscarPorCodigo(codigo: string): Promise<Equipamento | null> {
    return EQUIPAMENTOS.find((e) => e.codigo === codigo) ?? null;
  }

  async buscarPorCliente(clienteCodigo: string): Promise<Equipamento[]> {
    return EQUIPAMENTOS.filter((e) => e.clienteCodigo === clienteCodigo);
  }

  async buscarPorChassi(chassi: string): Promise<Equipamento | null> {
    const limpo = chassi.trim().toUpperCase();
    if (!limpo) return null;
    return EQUIPAMENTOS.find((e) => e.chassi?.toUpperCase() === limpo) ?? null;
  }

  async buscarPorPlaca(placa: string): Promise<Equipamento | null> {
    const limpa = placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return EQUIPAMENTOS.find((e) => e.identificacao?.toUpperCase().replace(/[^A-Z0-9]/g, '') === limpa) ?? null;
  }

  async buscar(query: SearchQuery): Promise<PaginatedResult<Equipamento>> {
    let filtered = EQUIPAMENTOS;
    if (query.clienteCodigo) {
      filtered = filtered.filter((e) => e.clienteCodigo === query.clienteCodigo);
    }
    if (query.codigo) {
      filtered = filtered.filter((e) => e.codigo === query.codigo);
    } else if (query.descricao) {
      const termo = query.descricao.toLowerCase();
      const placa = termo.replace(/[^a-z0-9]/g, '');
      filtered = filtered.filter(
        (e) =>
          e.descricao.toLowerCase().includes(termo) ||
          (!!placa &&
            (e.identificacao ?? '')
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '')
              .includes(placa)),
      );
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const start = (page - 1) * limit;
    const clientes = new ClienteRepositoryMock();
    const items = await Promise.all(
      filtered.slice(start, start + limit).map(async (e) => ({
        ...e,
        clienteNome: (await clientes.buscarPorCodigo(e.clienteCodigo))?.nome,
      })),
    );
    return { items, page, limit, total: filtered.length };
  }

  async criar(input: EquipamentoInput): Promise<Equipamento> {
    const descricao = [input.marca, input.modelo].filter(Boolean).join(' ') || input.placa;
    const equipamento: Equipamento = {
      codigo: `EQ${String(proximoCodigo++).padStart(2, '0')}`,
      descricao,
      clienteCodigo: input.clienteCodigo,
      identificacao: input.placa,
      marca: input.marca,
      modelo: input.modelo,
      anoFabricacao: input.anoFabricacao,
      anoModelo: input.anoModelo,
      cor: input.cor,
      chassi: input.chassi,
      kmAtual: input.kmAtual,
    };
    EQUIPAMENTOS.push(equipamento);
    return equipamento;
  }

  async atualizar(codigo: string, input: EquipamentoInput): Promise<Equipamento> {
    const idx = EQUIPAMENTOS.findIndex((e) => e.codigo === codigo);
    if (idx === -1) throw new Error('Equipamento não encontrado.');
    const descricao = [input.marca, input.modelo].filter(Boolean).join(' ') || input.placa;
    const atualizado: Equipamento = {
      ...EQUIPAMENTOS[idx]!,
      descricao,
      clienteCodigo: input.clienteCodigo,
      identificacao: input.placa,
      marca: input.marca,
      modelo: input.modelo,
      anoFabricacao: input.anoFabricacao,
      anoModelo: input.anoModelo,
      cor: input.cor,
      chassi: input.chassi,
      kmAtual: input.kmAtual,
    };
    EQUIPAMENTOS[idx] = atualizado;
    return atualizado;
  }
}
