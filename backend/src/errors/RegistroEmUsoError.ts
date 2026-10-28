import { AppError } from './AppError.js';

/**
 * O CHERP não deixou gravar porque o registro está travado por outra transação (ex.: a OS aberta em edição
 * numa tela do CHERP desktop) ou a gravação ficou esperando até estourar o tempo. Não é queda do ERP, então
 * não vira 503: o usuário precisa saber o que fazer.
 */
export class RegistroEmUsoError extends AppError {
  constructor(
    message = 'Este registro está em uso no CHERP (aberto por outra pessoa ou outra tela) e não foi possível gravar agora. Feche-o lá e tente novamente.',
  ) {
    super('CHERP_REGISTRO_EM_USO', message, 409);
    this.name = 'RegistroEmUsoError';
  }
}
