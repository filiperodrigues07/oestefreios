import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./auditLog.service.js', () => ({ recordAudit: vi.fn(async () => undefined) }));

import { osRepository } from '../repositories/index.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import { excluirOSSchema } from '../validators/os.validator.js';
import { recordAudit } from './auditLog.service.js';
import { duplicarOS, excluirOS } from './os.service.js';

const usuario: AuthenticatedUser = {
  id: 'u1',
  email: 'admin@teste.local',
  name: 'Admin Teste',
  roleId: 'r1',
  roleName: 'Administrador',
  permissions: ['OS_VIEW', 'OS_CREATE', 'OS_DELETE', 'FINANCIAL_VIEW'],
  mustChangePassword: false,
};

async function acharPorNumero(numero: number) {
  const { items } = await osRepository.listar({ incluirFinalizadas: true, limit: 100 });
  const os = items.find((o) => o.numero === numero);
  if (!os) throw new Error(`OS ${numero} não existe no mock`);
  return os;
}

beforeEach(() => {
  vi.mocked(recordAudit).mockClear();
});

describe('excluir OS', () => {
  it('exclui OS aberta e registra o motivo na auditoria', async () => {
    const criada = await duplicarOS((await acharPorNumero(1234)).id, usuario);
    await excluirOS(criada.id, 'Lançada por engano', usuario);

    expect(await osRepository.buscarPorId(criada.id)).toBeNull();
    const chamada = vi.mocked(recordAudit).mock.calls.find(([entrada]) => entrada.event === 'OS_DELETED');
    expect(chamada?.[0]).toMatchObject({
      entityType: 'OS',
      entityId: criada.id,
      userName: 'Admin Teste',
      changes: { motivo: 'Lançada por engano' },
    });
  });

  it('bloqueia exclusão de OS finalizada / com pedido gerado', async () => {
    const finalizada = await acharPorNumero(1230);
    await expect(excluirOS(finalizada.id, 'Motivo qualquer', usuario)).rejects.toThrow(/somente consulta/);
    expect(await osRepository.buscarPorId(finalizada.id)).not.toBeNull();
  });

  it('exige motivo com pelo menos 5 caracteres', () => {
    expect(excluirOSSchema.safeParse({ motivo: '   ' }).success).toBe(false);
    expect(excluirOSSchema.safeParse({ motivo: 'abc' }).success).toBe(false);
    expect(excluirOSSchema.parse({ motivo: '  Cliente desistiu  ' }).motivo).toBe('Cliente desistiu');
  });
});

describe('duplicar OS', () => {
  it('copia cabeçalho e itens com número e DAV novos, sem tocar na origem', async () => {
    const origem = await acharPorNumero(1234);
    const nova = await duplicarOS(origem.id, usuario);

    expect(nova.id).not.toBe(origem.id);
    expect(nova.numero).not.toBe(origem.numero);
    expect(nova.nroDav).toBeTruthy();
    expect(nova.nroDav).not.toBe(origem.nroDav);
    expect(nova.clienteCodigo).toBe(origem.clienteCodigo);
    expect(nova.equipamentoCodigo).toBe(origem.equipamentoCodigo);
    expect(nova.problema).toBe(origem.problema);
    expect(nova.status).toBe('ABERTA');
    expect(nova.produtos).toHaveLength(origem.produtos.length);
    expect(nova.servicos).toHaveLength(origem.servicos.length);
    expect(nova.produtos[0]?.produtoCodigo).toBe(origem.produtos[0]?.produtoCodigo);

    const origemDepois = await osRepository.buscarPorId(origem.id);
    expect(origemDepois?.numero).toBe(origem.numero);
    expect(origemDepois?.produtos).toHaveLength(origem.produtos.length);

    const chamada = vi.mocked(recordAudit).mock.calls.find(([entrada]) => entrada.event === 'OS_DUPLICATED');
    expect(chamada?.[0]).toMatchObject({ entityId: nova.id, changes: { origemId: origem.id, numeroOrigem: origem.numero } });
  });

  it('permite duplicar OS já finalizada', async () => {
    const finalizada = await acharPorNumero(1230);
    const nova = await duplicarOS(finalizada.id, usuario);

    expect(nova.numero).not.toBe(finalizada.numero);
    expect(nova.status).toBe('ABERTA');
    expect(nova.dataConclusao).toBeUndefined();
    expect(nova.produtos).toHaveLength(finalizada.produtos.length);
  });
});
