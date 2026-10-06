import { describe, expect, it, vi } from 'vitest';

vi.mock('./auditLog.service.js', () => ({ recordAudit: vi.fn(async () => undefined) }));

import type { AuthenticatedUser } from '../types/auth.types.js';
import { atualizarOSSchema } from '../validators/os.validator.js';
import { atualizarOS, criarOS } from './os.service.js';

const usuario: AuthenticatedUser = {
  id: 'u1',
  email: 'atendente@teste.local',
  name: 'Atendente Teste',
  roleId: 'r1',
  roleName: 'Atendente',
  permissions: ['OS_VIEW', 'OS_CREATE', 'OS_EDIT'],
  mustChangePassword: false,
};

describe('diagnóstico de abertura (problema) editável após abrir a OS', () => {
  it('altera o texto e registra no histórico', async () => {
    const criada = await criarOS({ clienteCodigo: '000001', equipamentoCodigo: 'EQ01', problema: 'BARULHO', prioridade: 'NORMAL', kmAtual: 0, kmFinal: 0 }, usuario);
    const alterada = await atualizarOS(criada.id, { problema: 'BARULHO NO FREIO TRASEIRO' }, usuario);
    expect(alterada.problema).toBe('BARULHO NO FREIO TRASEIRO');
    expect(alterada.historico.at(-1)?.evento).toMatch(/problema/);
  });

  it('o schema põe em maiúsculas, aceita vazio e limita a 5000 caracteres', () => {
    expect(atualizarOSSchema.parse({ problema: ' pastilha gasta ' }).problema).toBe('PASTILHA GASTA');
    expect(atualizarOSSchema.safeParse({ problema: '' }).success).toBe(true);
    expect(atualizarOSSchema.safeParse({ problema: 'x'.repeat(5001) }).success).toBe(false);
  });
});
