import { describe, expect, it, vi } from 'vitest';

vi.mock('./auditLog.service.js', () => ({ recordAudit: vi.fn(async () => undefined) }));

import { osRepository } from '../repositories/index.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import { adicionarProdutoOS, duplicarOS } from './os.service.js';

const usuario: AuthenticatedUser = {
  id: 'u1',
  email: 'admin@teste.local',
  name: 'Admin Teste',
  roleId: 'r1',
  roleName: 'Administrador',
  permissions: ['OS_VIEW', 'OS_CREATE', 'PRODUCT_ADD_TO_OS', 'FINANCIAL_VIEW', 'FINANCIAL_EDIT'],
  mustChangePassword: false,
};

async function osAberta() {
  const { items } = await osRepository.listar({ incluirFinalizadas: true, limit: 100 });
  const origem = items.find((o) => o.numero === 1234);
  if (!origem) throw new Error('OS 1234 não existe no mock');
  return duplicarOS(origem.id, usuario, { kmAtual: 0, kmFinal: 0 });
}

describe('lançar produto com estoque zerado', () => {
  it('bloqueia e avisa para verificar com o responsável', async () => {
    const os = await osAberta();
    await expect(adicionarProdutoOS(os.id, '00012359', 1, usuario)).rejects.toThrow(
      /estoque zerado.*responsável/,
    );
    expect((await osRepository.buscarPorId(os.id))?.produtos.some((p) => p.produtoCodigo === '00012359')).toBe(false);
  });

  it('produto com saldo continua lançando', async () => {
    const os = await osAberta();
    await adicionarProdutoOS(os.id, '00012358', 1, usuario);
    expect((await osRepository.buscarPorId(os.id))?.produtos.some((p) => p.produtoCodigo === '00012358')).toBe(true);
  });
});
