import { describe, expect, it, vi } from 'vitest';

vi.mock('./auditLog.service.js', () => ({ recordAudit: vi.fn(async () => undefined) }));

import { osRepository } from '../repositories/index.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import { duplicarOS, removerProdutoOS, restaurarItemOS } from './os.service.js';

const usuario: AuthenticatedUser = {
  id: 'u1',
  email: 'admin@teste.local',
  name: 'Admin Teste',
  roleId: 'r1',
  roleName: 'Administrador',
  permissions: ['OS_VIEW', 'OS_CREATE', 'PRODUCT_ADD_TO_OS', 'FINANCIAL_VIEW'],
  mustChangePassword: false,
};

async function osComProduto() {
  const { items } = await osRepository.listar({ incluirFinalizadas: true, limit: 100 });
  const origem = items.find((o) => o.numero === 1234);
  if (!origem) throw new Error('OS 1234 não existe no mock');
  const nova = await duplicarOS(origem.id, usuario);
  const os = await osRepository.buscarPorId(nova.id);
  if (!os?.produtos[0]) throw new Error('OS de teste precisa ter produto');
  return os;
}

describe('desfazer remoção de item', () => {
  it('restaura o produto com a mesma quantidade e preço', async () => {
    const os = await osComProduto();
    const item = os.produtos[0]!;
    await removerProdutoOS(os.id, item.produtoCodigo, usuario);
    expect((await osRepository.buscarPorId(os.id))?.produtos.some((p) => p.produtoCodigo === item.produtoCodigo)).toBe(false);

    await restaurarItemOS(os.id, 'produto', item.produtoCodigo, usuario);
    const restaurado = (await osRepository.buscarPorId(os.id))?.produtos.find((p) => p.produtoCodigo === item.produtoCodigo);
    expect(restaurado).toMatchObject({ quantidade: item.quantidade, precoUnitario: item.precoUnitario });
  });

  it('não duplica item que já está na OS', async () => {
    const os = await osComProduto();
    await expect(restaurarItemOS(os.id, 'produto', os.produtos[0]!.produtoCodigo, usuario)).rejects.toThrow(/já está na OS/);
  });

  it('404 quando nunca foi removido', async () => {
    const os = await osComProduto();
    await expect(restaurarItemOS(os.id, 'servico', 'NAO-EXISTE', usuario)).rejects.toMatchObject({ statusCode: 404 });
  });
});
