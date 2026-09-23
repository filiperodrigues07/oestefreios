import { ClienteRepositoryFirebird } from './firebird/ClienteRepository.firebird.js';
import { EquipamentoRepositoryFirebird } from './firebird/EquipamentoRepository.firebird.js';
import { OSRepositoryFirebird } from './firebird/OSRepository.firebird.js';
import { ProdutoRepositoryFirebird } from './firebird/ProdutoRepository.firebird.js';
import { ServicoRepositoryFirebird } from './firebird/ServicoRepository.firebird.js';
import { ClienteRepositoryMock } from './mock/ClienteRepository.mock.js';
import { EquipamentoRepositoryMock } from './mock/EquipamentoRepository.mock.js';
import { OSRepositoryMock } from './mock/OSRepository.mock.js';
import { ProdutoRepositoryMock } from './mock/ProdutoRepository.mock.js';
import { ServicoRepositoryMock } from './mock/ServicoRepository.mock.js';
import { getCherpMode } from './cherpMode.js';

/**
 * Factory central de repositórios. Services dependem só das interfaces
 * (`interfaces/I*Repository.ts`), nunca destas classes concretas.
 *
 * Cada export é um proxy que resolve mock/Firebird a cada chamada olhando `getCherpMode()`,
 * em vez de decidir uma vez só no boot — salvar uma conexão Firebird válida pela tela de
 * Configurações troca o modo em runtime (ver settings.service.ts), sem precisar reiniciar
 * o processo. As duas instâncias (mock e Firebird) sempre existem; instanciar não abre
 * conexão nenhuma, só a primeira query real faz isso.
 *
 * OS grava/lê direto em ORDEMSERVICO no CHERP (ver OSRepository.firebird.ts pro que é
 * espelhado lá vs. o que fica só no Postgres da aplicação).
 */
function proxyFor<T extends object>(mock: T, firebird: T): T {
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      const impl = getCherpMode() === 'firebird' ? firebird : mock;
      const value = Reflect.get(impl as object, prop, receiver);
      return typeof value === 'function' ? value.bind(impl) : value;
    },
  });
}

export const produtoRepository = proxyFor(new ProdutoRepositoryMock(), new ProdutoRepositoryFirebird());
export const servicoRepository = proxyFor(new ServicoRepositoryMock(), new ServicoRepositoryFirebird());
export const clienteRepository = proxyFor(new ClienteRepositoryMock(), new ClienteRepositoryFirebird());
export const equipamentoRepository = proxyFor(new EquipamentoRepositoryMock(), new EquipamentoRepositoryFirebird());
export const osRepository = proxyFor(new OSRepositoryMock(), new OSRepositoryFirebird());
