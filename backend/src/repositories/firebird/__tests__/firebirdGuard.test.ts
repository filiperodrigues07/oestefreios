import { describe, expect, it } from 'vitest';
import { NotImplementedError } from '../../../errors/NotImplementedError.js';
import { ClienteRepositoryFirebird } from '../ClienteRepository.firebird.js';
import { EquipamentoRepositoryFirebird } from '../EquipamentoRepository.firebird.js';
import { ProdutoRepositoryFirebird } from '../ProdutoRepository.firebird.js';
import { ServicoRepositoryFirebird } from '../ServicoRepository.firebird.js';

/**
 * Enquanto as queries reais do CHERP não forem preenchidas (seção 58 do
 * briefing), os repositórios Firebird devem falhar de forma clara e
 * controlada (501), nunca silenciosamente devolver dado errado ou tentar
 * uma conexão real. Isso é o que protege o CHERP_MODE=firebird de virar
 * uma armadilha silenciosa antes do SQL chegar.
 */
describe('repositórios Firebird sem query preenchida', () => {
  it('ProdutoRepositoryFirebird lança NotImplementedError em todos os métodos', async () => {
    const repo = new ProdutoRepositoryFirebird();
    await expect(repo.buscarPorCodigo('00012345')).rejects.toBeInstanceOf(NotImplementedError);
    await expect(repo.buscarPorDescricao('filtro')).rejects.toBeInstanceOf(NotImplementedError);
    await expect(repo.buscar({})).rejects.toBeInstanceOf(NotImplementedError);
  });

  it('ServicoRepositoryFirebird lança NotImplementedError em todos os métodos', async () => {
    const repo = new ServicoRepositoryFirebird();
    await expect(repo.buscarPorCodigo('5012')).rejects.toBeInstanceOf(NotImplementedError);
    await expect(repo.buscarPorDescricao('troca')).rejects.toBeInstanceOf(NotImplementedError);
    await expect(repo.buscar({})).rejects.toBeInstanceOf(NotImplementedError);
  });

  it('ClienteRepositoryFirebird lança NotImplementedError em todos os métodos', async () => {
    const repo = new ClienteRepositoryFirebird();
    await expect(repo.buscarPorCodigo('000001')).rejects.toBeInstanceOf(NotImplementedError);
    await expect(repo.buscarPorNome('joão')).rejects.toBeInstanceOf(NotImplementedError);
    await expect(repo.buscar({})).rejects.toBeInstanceOf(NotImplementedError);
  });

  it('EquipamentoRepositoryFirebird lança NotImplementedError em todos os métodos', async () => {
    const repo = new EquipamentoRepositoryFirebird();
    await expect(repo.buscarPorCodigo('EQ01')).rejects.toBeInstanceOf(NotImplementedError);
    await expect(repo.buscarPorCliente('000001')).rejects.toBeInstanceOf(NotImplementedError);
    await expect(repo.buscar({})).rejects.toBeInstanceOf(NotImplementedError);
  });
});
