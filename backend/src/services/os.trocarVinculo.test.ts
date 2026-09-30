import { describe, expect, it, vi } from 'vitest';

vi.mock('./auditLog.service.js', () => ({ recordAudit: vi.fn(async () => undefined) }));

import { osRepository } from '../repositories/index.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import { trocarVinculoOSSchema } from '../validators/os.validator.js';
import { recordAudit } from './auditLog.service.js';
import { trocarVinculoOS } from './os.service.js';

const usuario: AuthenticatedUser = {
  id: 'u1',
  email: 'atendente@teste.local',
  name: 'Atendente Teste',
  roleId: 'r1',
  roleName: 'Atendente',
  permissions: ['OS_VIEW', 'OS_CREATE', 'OS_EDIT'],
  mustChangePassword: false,
};

async function osSemItens() {
  return osRepository.criar({
    clienteCodigo: '000001',
    equipamentoCodigo: 'EQ01',
    problema: 'TESTE',
    prioridade: 'NORMAL',
    status: 'ABERTA',
    produtos: [],
    servicos: [],
    historico: [],
    dataAbertura: new Date().toISOString(),
  });
}

describe('trocar cliente/veículo da OS', () => {
  it('troca quando a OS não tem produto nem serviço, com histórico e auditoria', async () => {
    const os = await osSemItens();
    const trocada = await trocarVinculoOS(
      os.id,
      { clienteCodigo: '000002', equipamentoCodigo: 'EQ02' },
      usuario,
    );
    expect(trocada.clienteCodigo).toBe('000002');
    expect(trocada.equipamentoCodigo).toBe('EQ02');
    expect(trocada.historico.at(-1)?.evento).toMatch(/Cliente\/veículo trocados/);
    const chamada = vi.mocked(recordAudit).mock.calls.find(([e]) => e.event === 'OS_VINCULO_CHANGED');
    expect(chamada?.[0]).toMatchObject({ entityId: os.id });
  });

  it('recusa veículo de outro cliente', async () => {
    const os = await osSemItens();
    await expect(
      trocarVinculoOS(os.id, { clienteCodigo: '000002', equipamentoCodigo: 'EQ01' }, usuario),
    ).rejects.toThrow(/não pertence/);
  });

  it('recusa quando nada mudou', async () => {
    const os = await osSemItens();
    await expect(
      trocarVinculoOS(
        os.id,
        { clienteCodigo: os.clienteCodigo, equipamentoCodigo: os.equipamentoCodigo },
        usuario,
      ),
    ).rejects.toThrow(/já são os da OS/);
  });

  it('recusa quando a OS já tem produto ou serviço lançado', async () => {
    const os = await osSemItens();
    const atual = (await osRepository.buscarPorId(os.id))!;
    const { items } = await osRepository.listar({ incluirFinalizadas: true, limit: 100 });
    const comItens = items.find((o) => o.produtos.length > 0 || o.servicos.length > 0);
    if (!comItens) throw new Error('mock sem OS com itens');
    await osRepository.atualizar(atual.id, { produtos: comItens.produtos, servicos: comItens.servicos });
    await expect(
      trocarVinculoOS(os.id, { clienteCodigo: '000002', equipamentoCodigo: 'EQ02' }, usuario),
    ).rejects.toThrow(/produto ou serviço lançado/);
  });

  it('valida o corpo', () => {
    expect(trocarVinculoOSSchema.safeParse({ clienteCodigo: '1' }).success).toBe(false);
    expect(trocarVinculoOSSchema.safeParse({ clienteCodigo: '1', equipamentoCodigo: '2' }).success).toBe(true);
  });
});
