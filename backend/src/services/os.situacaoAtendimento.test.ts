import { describe, expect, it, vi } from 'vitest';

vi.mock('./auditLog.service.js', () => ({ recordAudit: vi.fn(async () => undefined) }));

import type { AuthenticatedUser } from '../types/auth.types.js';
import { osRepository } from '../repositories/index.js';
import { alterarStatusOS, duplicarOS, getOSById, listOS, reabrirOS } from './os.service.js';

const gerente: AuthenticatedUser = {
  id: 'u-sit', email: 'g@teste.local', name: 'Gerente', roleId: 'r', roleName: 'Gerente', mustChangePassword: false,
  permissions: ['OS_VIEW', 'OS_CREATE', 'OS_EDIT', 'OS_CHANGE_STATUS', 'OS_REOPEN', 'OS_VIEW_FINALIZADAS'],
};

async function osNova() {
  const { items } = await osRepository.listar({ incluirFinalizadas: true, limit: 100 });
  return duplicarOS(items.find((o) => o.numero === 1234)!.id, gerente, { kmAtual: 0, kmFinal: 0 });
}

describe('situação de atendimento do CHERP', () => {
  it('finalizar vira Pronta (ainda em aberto pro faturamento); reabrir volta pra Em atendimento', async () => {
    const os = await osNova();
    expect((await getOSById(os.id, gerente.permissions)).situacaoAtendimentoCodigo).toBe('000001');

    await alterarStatusOS(os.id, 'CONCLUIDA', gerente);
    const finalizada = await getOSById(os.id, gerente.permissions);
    expect(finalizada.situacaoAtendimentoCodigo).toBe('000004');
    expect(finalizada.situacaoDocumento ?? 0).toBe(0);

    await reabrirOS(os.id, 'Faltou trocar a lona', gerente);
    expect((await getOSById(os.id, gerente.permissions)).situacaoAtendimentoCodigo).toBe('000001');
  });

  it('filtra a lista pela situação de atendimento', async () => {
    const os = await osNova();
    await alterarStatusOS(os.id, 'AGUARDANDO_PECA', gerente);
    const { items } = await listOS({ situacaoAtendimento: '000003', incluirFinalizadas: true, limit: 100 }, gerente.permissions);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((o) => o.situacaoAtendimentoCodigo === '000003')).toBe(true);
    expect(items.some((o) => o.id === os.id)).toBe(true);
  });
});
