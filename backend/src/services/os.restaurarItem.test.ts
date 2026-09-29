import { describe, expect, it, vi } from 'vitest';

vi.mock('./auditLog.service.js', () => ({ recordAudit: vi.fn(async () => undefined) }));

import { osRepository } from '../repositories/index.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import {
  adicionarProdutoOS,
  adicionarServicoOS,
  atualizarProdutoOS,
  duplicarOS,
  removerProdutoOS,
  removerServicoOS,
  restaurarItemOS,
} from './os.service.js';

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
  const nova = await duplicarOS(origem.id, usuario, { kmAtual: 0, kmFinal: 0 });
  const os = await osRepository.buscarPorId(nova.id);
  if (!os?.produtos[0]) throw new Error('OS de teste precisa ter produto');
  return os;
}

describe('desfazer remoção de item', () => {
  it('restaura o produto com a mesma quantidade e preço', async () => {
    const os = await osComProduto();
    const item = os.produtos[0]!;
    await removerProdutoOS(os.id, item.produtoCodigo, usuario);
    expect(
      (await osRepository.buscarPorId(os.id))?.produtos.some(
        (p) => p.produtoCodigo === item.produtoCodigo,
      ),
    ).toBe(false);

    await restaurarItemOS(os.id, 'produto', item.produtoCodigo, usuario);
    const restaurado = (await osRepository.buscarPorId(os.id))?.produtos.find(
      (p) => p.produtoCodigo === item.produtoCodigo,
    );
    expect(restaurado).toMatchObject({
      quantidade: item.quantidade,
      precoUnitario: item.precoUnitario,
    });
  });

  it('não duplica item que já está na OS', async () => {
    const os = await osComProduto();
    await expect(
      restaurarItemOS(os.id, 'produto', os.produtos[0]!.produtoCodigo, usuario),
    ).rejects.toThrow(/já está na OS/);
  });

  it('404 quando nunca foi removido', async () => {
    const os = await osComProduto();
    await expect(restaurarItemOS(os.id, 'servico', 'NAO-EXISTE', usuario)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('linhas repetidas na OS', () => {
  it('mantém produtos e serviços em linhas independentes e remove/restaura a linha escolhida', async () => {
    const os = await osComProduto();
    const produto = os.produtos[0]!;
    const servico = os.servicos[0]!;
    await adicionarProdutoOS(os.id, produto.produtoCodigo, 2, usuario, {}, undefined, 'EX LD');
    await adicionarServicoOS(os.id, servico.servicoCodigo, 3, usuario, {}, undefined, 'EX LE');
    let atual = (await osRepository.buscarPorId(os.id))!;
    expect(atual.produtos).toHaveLength(2);
    expect(atual.servicos).toHaveLength(2);
    const novoProduto = atual.produtos.find((p) => p.descricaoComplementar === 'EX LD')!;
    const novoServico = atual.servicos.find((s) => s.descricaoComplementar === 'EX LE')!;
    expect(novoProduto.itemId).not.toBe(produto.itemId);
    expect(novoServico.itemId).not.toBe(servico.itemId);
    await atualizarProdutoOS(
      os.id,
      produto.produtoCodigo,
      { descricaoComplementar: 'EX LD NOVO', quantidade: 4 },
      usuario,
      {},
      novoProduto.itemId,
    );
    atual = (await osRepository.buscarPorId(os.id))!;
    expect(atual.produtos.find((p) => p.itemId === produto.itemId)?.quantidade).toBe(
      produto.quantidade,
    );
    expect(atual.produtos.find((p) => p.itemId === novoProduto.itemId)).toMatchObject({
      quantidade: 4,
      descricaoComplementar: 'EX LD NOVO',
    });
    await removerProdutoOS(os.id, produto.produtoCodigo, usuario, {}, novoProduto.itemId);
    await removerServicoOS(os.id, servico.servicoCodigo, usuario, {}, novoServico.itemId);
    atual = (await osRepository.buscarPorId(os.id))!;
    expect(atual.produtos).toHaveLength(1);
    expect(atual.servicos).toHaveLength(1);
    await restaurarItemOS(os.id, 'produto', produto.produtoCodigo, usuario, {}, novoProduto.itemId);
    atual = (await osRepository.buscarPorId(os.id))!;
    expect(atual.produtos).toHaveLength(2);
    expect(atual.produtos.find((p) => p.descricaoComplementar === 'EX LD NOVO')?.quantidade).toBe(
      4,
    );
  });
});
