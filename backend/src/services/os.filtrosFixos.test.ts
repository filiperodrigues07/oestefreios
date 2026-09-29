import { afterEach, describe, expect, it, vi } from 'vitest';
import { OSRepositoryMock } from '../repositories/mock/OSRepository.mock.js';
import { userRepository } from '../repositories/postgres/UserRepository.js';
import { listOS } from './os.service.js';

afterEach(() => vi.restoreAllMocks());

describe('filtros fixos de OS por usuário', () => {
  it('aplica os valores do cadastro mesmo quando a URL pede outros filtros', async () => {
    vi.spyOn(userRepository, 'getFixedOSFilters').mockResolvedValue({
      osStatusFixo: 0,
      osSituacaoAtendimentoFixa: '000001',
    });
    const listar = vi.spyOn(OSRepositoryMock.prototype, 'listar').mockResolvedValue({ items: [], total: 0 });

    await listOS(
      { situacaoDocumento: 4, situacaoAtendimento: '000004', somenteFinalizadasApp: true, incluirFinalizadas: true },
      ['OS_VIEW', 'OS_VIEW_FINALIZADAS'],
      'usuario-1',
    );

    expect(listar).toHaveBeenCalledWith(expect.objectContaining({
      situacaoDocumento: 0,
      situacaoAtendimento: '000001',
      somenteFinalizadasApp: false,
    }));
  });

  it('mantém filtros livres quando não há valores fixados', async () => {
    vi.spyOn(userRepository, 'getFixedOSFilters').mockResolvedValue({
      osStatusFixo: null,
      osSituacaoAtendimentoFixa: null,
    });
    const listar = vi.spyOn(OSRepositoryMock.prototype, 'listar').mockResolvedValue({ items: [], total: 0 });

    await listOS(
      { situacaoDocumento: 4, situacaoAtendimento: '000004' },
      ['OS_VIEW', 'OS_VIEW_FINALIZADAS'],
      'usuario-1',
    );

    expect(listar).toHaveBeenCalledWith(expect.objectContaining({
      situacaoDocumento: 4,
      situacaoAtendimento: '000004',
    }));
  });
});
