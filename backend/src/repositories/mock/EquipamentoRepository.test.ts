import { describe, expect, it } from 'vitest';
import { EquipamentoRepositoryMock } from './EquipamentoRepository.mock.js';

describe('Consulta de veículos', () => {
  const repository = new EquipamentoRepositoryMock();

  it('lista todos os clientes com paginação e nome do proprietário', async () => {
    const first = await repository.buscar({ page: 1, limit: 2 });
    const second = await repository.buscar({ page: 2, limit: 2 });
    expect(first.total).toBe(3);
    expect(first.items).toHaveLength(2);
    expect(second.items).toHaveLength(1);
    expect(first.items[0]?.clienteNome).toBe('João da Silva');
    expect(second.items[0]?.codigo).not.toBe(first.items[0]?.codigo);
  });

  it('encontra placa com e sem hífen e combina o filtro de cliente', async () => {
    for (const descricao of ['abc1234', 'ABC-1234']) {
      expect((await repository.buscar({ descricao })).items.map((v) => v.codigo)).toEqual(['EQ01']);
    }
    expect((await repository.buscar({ descricao: 'ABC1234', clienteCodigo: '000002' })).total).toBe(
      0,
    );
    expect((await repository.buscar({ clienteCodigo: '000002' })).total).toBe(2);
    expect((await repository.buscar({ descricao: 'Graneleira' })).items[0]?.codigo).toBe('EQ03');
  });
});
