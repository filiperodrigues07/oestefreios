import { describe, expect, it, vi } from 'vitest';

vi.mock('./auditLog.service.js', () => ({ recordAudit: vi.fn(async () => undefined) }));

import { osRepository } from '../repositories/index.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import { atualizarOSSchema } from '../validators/os.validator.js';
import { atualizarOS, duplicarOS } from './os.service.js';

const usuario: AuthenticatedUser = {
  id: 'u1',
  email: 'admin@teste.local',
  name: 'Admin Teste',
  roleId: 'r1',
  roleName: 'Administrador',
  permissions: ['OS_VIEW', 'OS_CREATE', 'OS_EDIT'],
  mustChangePassword: false,
};

async function novaOSAberta() {
  const { items } = await osRepository.listar({ incluirFinalizadas: true, limit: 100 });
  const origem = items.find((o) => o.numero === 1234);
  if (!origem) throw new Error('OS 1234 não existe no mock');
  return duplicarOS(origem.id, usuario);
}

describe('edição simultânea da OS (concorrência otimista)', () => {
  it('segunda edição feita sobre a mesma base recebe 409 e não sobrescreve', async () => {
    const os = await novaOSAberta();
    const base = { diagnostico: os.diagnostico ?? '' };

    await atualizarOS(os.id, { diagnostico: 'PASTILHA GASTA', base }, usuario);
    await expect(atualizarOS(os.id, { diagnostico: 'DISCO EMPENADO', base }, usuario)).rejects.toMatchObject({
      statusCode: 409,
      code: 'OS_CONFLICT',
    });
    expect((await osRepository.buscarPorId(os.id))?.diagnostico).toBe('PASTILHA GASTA');
  });

  it('mudança em outro campo não gera conflito', async () => {
    const os = await novaOSAberta();
    await atualizarOS(os.id, { observacoes: 'CLIENTE AGUARDA', base: { observacoes: os.observacoes ?? '' } }, usuario);
    const atualizado = await atualizarOS(os.id, { diagnostico: 'OK', base: { diagnostico: os.diagnostico ?? '' } }, usuario);
    expect(atualizado.diagnostico).toBe('OK');
  });

  it('sem base (cliente antigo ou "sobrescrever") grava direto', async () => {
    const os = await novaOSAberta();
    await atualizarOS(os.id, { diagnostico: 'A', base: { diagnostico: os.diagnostico ?? '' } }, usuario);
    const atualizado = await atualizarOS(os.id, { diagnostico: 'B' }, usuario);
    expect(atualizado.diagnostico).toBe('B');
  });

  it('só base, sem campo, é rejeitado na validação', () => {
    expect(atualizarOSSchema.safeParse({ base: { diagnostico: '' } }).success).toBe(false);
  });
});
