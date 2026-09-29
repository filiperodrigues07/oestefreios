import { afterEach, describe, expect, it, vi } from 'vitest';

import { clienteRepository } from '../repositories/index.js';
import { ClienteRepositoryMock } from '../repositories/mock/ClienteRepository.mock.js';
import { OSRepositoryMock } from '../repositories/mock/OSRepository.mock.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import { criarOS } from './os.service.js';

const usuario: AuthenticatedUser = {
  id: 'u1',
  email: 'admin@teste.local',
  name: 'Admin Teste',
  roleId: 'r1',
  roleName: 'Administrador',
  permissions: ['OS_VIEW', 'OS_CREATE'],
  mustChangePassword: false,
};

afterEach(() => vi.restoreAllMocks());

describe('criacao de OS', () => {
  it('rejeita cliente inativo antes de gravar no CHERP', async () => {
    const cliente = await clienteRepository.buscarPorCodigo('000001');
    if (!cliente) throw new Error('Cliente de teste ausente');
    vi.spyOn(ClienteRepositoryMock.prototype, 'buscarPorCodigo').mockResolvedValueOnce({
      ...cliente,
      ativo: false,
    });
    const criar = vi
      .spyOn(OSRepositoryMock.prototype, 'criar')
      .mockRejectedValue(new Error('gravacao indevida'));

    await expect(
      criarOS(
        {
          clienteCodigo: '000001',
          equipamentoCodigo: 'EQ01',
          problema: '',
          prioridade: 'NORMAL',
          kmAtual: 0,
          kmFinal: 0,
        },
        usuario,
      ),
    ).rejects.toThrow('Cliente inativo no CHERP');
    expect(criar).not.toHaveBeenCalled();
  });
});
