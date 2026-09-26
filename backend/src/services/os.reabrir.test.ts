import { describe, expect, it, vi } from 'vitest';

vi.mock('./auditLog.service.js', () => ({ recordAudit: vi.fn(async () => undefined) }));

import { osRepository } from '../repositories/index.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import { reabrirOSSchema } from '../validators/os.validator.js';
import { recordAudit } from './auditLog.service.js';
import { alterarStatusOS, atualizarOS, duplicarOS, reabrirOS } from './os.service.js';

const usuario: AuthenticatedUser = {
  id: 'u1',
  email: 'gerente@teste.local',
  name: 'Gerente Teste',
  roleId: 'r1',
  roleName: 'Gerente',
  permissions: ['OS_VIEW', 'OS_CREATE', 'OS_EDIT', 'OS_CHANGE_STATUS', 'OS_REOPEN'],
  mustChangePassword: false,
};

async function osAberta() {
  const { items } = await osRepository.listar({ incluirFinalizadas: true, limit: 100 });
  const origem = items.find((o) => o.numero === 1234);
  if (!origem) throw new Error('OS 1234 não existe no mock');
  return duplicarOS(origem.id, usuario);
}

describe('reabrir OS', () => {
  it('OS finalizada pelo app volta a ser editável, com motivo no histórico e na auditoria', async () => {
    const os = await osAberta();
    await alterarStatusOS(os.id, 'CONCLUIDA', usuario);
    await expect(atualizarOS(os.id, { diagnostico: 'X' }, usuario)).rejects.toThrow(/somente consulta/);

    const reaberta = await reabrirOS(os.id, 'Finalizada por engano', usuario);
    expect(reaberta.status).toBe('ABERTA');
    expect(reaberta.historico.at(-1)?.evento).toMatch(/reaberta.*Finalizada por engano/);
    expect((await atualizarOS(os.id, { diagnostico: 'AGORA VAI' }, usuario)).diagnostico).toBe('AGORA VAI');

    const chamada = vi.mocked(recordAudit).mock.calls.find(([e]) => e.event === 'OS_REOPENED');
    expect(chamada?.[0]).toMatchObject({ entityId: os.id, changes: { motivo: 'Finalizada por engano' } });
  });

  it('OS que não está finalizada não é "reaberta"', async () => {
    const os = await osAberta();
    await expect(reabrirOS(os.id, 'Motivo qualquer', usuario)).rejects.toThrow(/não está finalizada/);
  });

  it('OS com pedido/NF gerado no CHERP continua somente consulta', async () => {
    const { items } = await osRepository.listar({ incluirFinalizadas: true, limit: 100 });
    const faturada = items.find((o) => (o.situacaoDocumento ?? 0) !== 0);
    if (!faturada) throw new Error('mock sem OS faturada');
    await expect(reabrirOS(faturada.id, 'Motivo qualquer', usuario)).rejects.toThrow(/CHERP/);
  });

  it('exige motivo', () => {
    expect(reabrirOSSchema.safeParse({ motivo: 'ok' }).success).toBe(false);
  });
});
