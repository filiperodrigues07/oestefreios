import { env } from '../config/env.js';
import { ClienteRepositoryFirebird } from './firebird/ClienteRepository.firebird.js';
import { EquipamentoRepositoryFirebird } from './firebird/EquipamentoRepository.firebird.js';
import { ProdutoRepositoryFirebird } from './firebird/ProdutoRepository.firebird.js';
import { ServicoRepositoryFirebird } from './firebird/ServicoRepository.firebird.js';
import { ClienteRepositoryMock } from './mock/ClienteRepository.mock.js';
import { EquipamentoRepositoryMock } from './mock/EquipamentoRepository.mock.js';
import { OSRepositoryMock } from './mock/OSRepository.mock.js';
import { ProdutoRepositoryMock } from './mock/ProdutoRepository.mock.js';
import { ServicoRepositoryMock } from './mock/ServicoRepository.mock.js';

/**
 * Factory central de repositórios. Services dependem só das interfaces
 * (`interfaces/I*Repository.ts`), nunca destas classes concretas — trocar
 * mock por Firebird real é só isto aqui, resolvido por CHERP_MODE no .env.
 *
 * OS não tem variante Firebird: sua persistência é decisão própria da
 * aplicação (não fazia parte do pedido de queries do CHERP), então continua
 * só no mock enquanto isso não for definido.
 */
const useFirebird = env.CHERP_MODE === 'firebird';

export const produtoRepository = useFirebird ? new ProdutoRepositoryFirebird() : new ProdutoRepositoryMock();
export const servicoRepository = useFirebird ? new ServicoRepositoryFirebird() : new ServicoRepositoryMock();
export const clienteRepository = useFirebird ? new ClienteRepositoryFirebird() : new ClienteRepositoryMock();
export const equipamentoRepository = useFirebird ? new EquipamentoRepositoryFirebird() : new EquipamentoRepositoryMock();
export const osRepository = new OSRepositoryMock();
