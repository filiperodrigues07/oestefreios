import { ClienteRepositoryMock } from './mock/ClienteRepository.mock.js';
import { EquipamentoRepositoryMock } from './mock/EquipamentoRepository.mock.js';
import { OSRepositoryMock } from './mock/OSRepository.mock.js';
import { ProdutoRepositoryMock } from './mock/ProdutoRepository.mock.js';
import { ServicoRepositoryMock } from './mock/ServicoRepository.mock.js';

/**
 * Factory central de repositórios. Services dependem só das interfaces
 * (`interfaces/I*Repository.ts`); trocar mock por Firebird real na Fase 5
 * significa mudar só estas instâncias, não os services/controllers.
 */
export const produtoRepository = new ProdutoRepositoryMock();
export const servicoRepository = new ServicoRepositoryMock();
export const clienteRepository = new ClienteRepositoryMock();
export const equipamentoRepository = new EquipamentoRepositoryMock();
export const osRepository = new OSRepositoryMock();
