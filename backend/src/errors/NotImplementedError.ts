import { AppError } from './AppError.js';

/**
 * Lançado pelos repositórios Firebird (src/repositories/firebird/) enquanto a
 * query real do CHERP ainda não foi preenchida. Nunca deve aparecer em produção
 * com CHERP_MODE=firebird de verdade — é um lembrete de implementação pendente,
 * não uma falha de runtime esperada.
 */
export class NotImplementedError extends AppError {
  constructor(query: string) {
    super(
      'CHERP_QUERY_NOT_IMPLEMENTED',
      `Query "${query}" ainda não foi implementada. Preencha em backend/src/repositories/firebird/ (ver database/queries/CONTRATO.md).`,
      501,
    );
    this.name = 'NotImplementedError';
  }
}
