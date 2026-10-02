import { describe, expect, it, vi } from 'vitest';

vi.mock('./auditLog.service.js', () => ({ recordAudit: vi.fn(async () => undefined) }));

import type { AuthenticatedUser } from '../types/auth.types.js';
import { atualizarOSSchema, criarOSSchema } from '../validators/os.validator.js';
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

const base = { clienteCodigo: '000001', equipamentoCodigo: 'EQ01', problema: 'TESTE', prioridade: 'NORMAL' as const, kmAtual: 0, kmFinal: 0 };

describe('garantia da OS', () => {
  it('grava na criação, altera e limpa na edição', async () => {
    const criada = await criarOS({ ...base, garantia: '2027-03-15' }, usuario);
    expect(criada.garantia).toBe('2027-03-15');

    const alterada = await atualizarOS(criada.id, { garantia: '2027-06-30' }, usuario);
    expect(alterada.garantia).toBe('2027-06-30');

    // Editar outro campo não mexe na garantia.
    const outraEdicao = await atualizarOS(criada.id, { diagnostico: 'OK' }, usuario);
    expect(outraEdicao.garantia).toBe('2027-06-30');

    // `null` limpa (a tela não oferece, mas a API aceita).
    const limpa = await atualizarOS(criada.id, { garantia: null }, usuario);
    expect(limpa.garantia).toBeUndefined();
  });

  it('sem garantia informada, nasce com a data de abertura (como no CHERP)', async () => {
    const criada = await criarOS(base, usuario);
    const abertura = new Date(criada.dataAbertura);
    const dois = (n: number) => String(n).padStart(2, '0');
    expect(criada.garantia).toBe(`${abertura.getFullYear()}-${dois(abertura.getMonth() + 1)}-${dois(abertura.getDate())}`);
  });

  it('valida o formato da data (dia de calendário)', () => {
    expect(criarOSSchema.safeParse({ ...base, garantia: '2027-03-15' }).success).toBe(true);
    expect(criarOSSchema.safeParse({ ...base, garantia: '15/03/2027' }).success).toBe(false);
    expect(criarOSSchema.safeParse({ ...base, garantia: '2027-02-30' }).success).toBe(false);
    expect(atualizarOSSchema.safeParse({ garantia: null }).success).toBe(true);
    expect(atualizarOSSchema.safeParse({ garantia: 'amanhã' }).success).toBe(false);
  });
});
