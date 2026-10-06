import { describe, expect, it, vi } from 'vitest';

vi.mock('./auditLog.service.js', () => ({ recordAudit: vi.fn(async () => undefined) }));

import { osRepository } from '../repositories/index.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import { adicionarProdutoOS, atualizarProdutoOS, duplicarOS } from './os.service.js';

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

// Saldos do mock: Correia do alternador (00012358) = 14 UN; Amortecedor dianteiro (00012351) = 6 UN.
describe('lançar mais do que o saldo', () => {
  const linhas = async (osId: string, codigo: string) =>
    (await osRepository.buscarPorId(osId))?.produtos.filter((p) => p.produtoCodigo === codigo) ?? [];

  it('bloqueia quantidade acima do saldo e aceita exatamente o saldo', async () => {
    const os = await osAberta();
    await expect(adicionarProdutoOS(os.id, '00012358', 15, usuario)).rejects.toThrow(
      /tem só 14 UN em estoque\. Dá para lançar no máximo 14 UN/,
    );
    expect(await linhas(os.id, '00012358')).toHaveLength(0);
    await adicionarProdutoOS(os.id, '00012358', 14, usuario);
    expect(await linhas(os.id, '00012358')).toHaveLength(1);
  });

  it('soma o que já está lançado nesta OS (a baixa só acontece no CHERP)', async () => {
    const os = await osAberta();
    await adicionarProdutoOS(os.id, '00012358', 10, usuario);
    await expect(adicionarProdutoOS(os.id, '00012358', 5, usuario)).rejects.toThrow(
      /10 já estão lançados nesta OS\. Dá para lançar no máximo 4 UN/,
    );
    await adicionarProdutoOS(os.id, '00012358', 4, usuario);
    await expect(adicionarProdutoOS(os.id, '00012358', 1, usuario)).rejects.toThrow(/Não dá para lançar mais/);
  });

  it('aceita quantidade decimal sem erro de arredondamento', async () => {
    const os = await osAberta();
    await adicionarProdutoOS(os.id, '00012358', 13.9, usuario);
    await adicionarProdutoOS(os.id, '00012358', 0.1, usuario);
    expect(await linhas(os.id, '00012358')).toHaveLength(2);
  });

  it('editar a quantidade: aumentar confere o saldo, diminuir sempre pode', async () => {
    const os = await osAberta();
    await adicionarProdutoOS(os.id, '00012351', 2, usuario);
    await expect(atualizarProdutoOS(os.id, '00012351', { quantidade: 7 }, usuario)).rejects.toThrow(
      /tem só 6 UN em estoque/,
    );
    await atualizarProdutoOS(os.id, '00012351', { quantidade: 6 }, usuario);
    expect((await linhas(os.id, '00012351'))[0]?.quantidade).toBe(6);
    await atualizarProdutoOS(os.id, '00012351', { quantidade: 1 }, usuario);
    expect((await linhas(os.id, '00012351'))[0]?.quantidade).toBe(1);
  });

  it('não duplica OS cujos produtos passam do saldo atual', async () => {
    const os = await osAberta();
    const atual = (await osRepository.buscarPorId(os.id))!;
    const item = { produtoCodigo: '00012351', descricao: 'Amortecedor dianteiro', unidade: 'UN', quantidade: 8, precoUnitario: 320, desconto: 0, total: 2560 };
    await osRepository.atualizar(os.id, { produtos: [...atual.produtos, item] });
    await expect(duplicarOS(os.id, usuario, { kmAtual: 0, kmFinal: 0 })).rejects.toThrow(
      /Não dá para duplicar.*Amortecedor dianteiro \(precisa 8, tem 6\)/,
    );
  });
});
