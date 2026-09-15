/**
 * Lançado no lugar de uma resposta real quando uma mutação é feita sem
 * internet e vai pra fila (seção 26) em vez de executar. Quem chama decide
 * a mensagem exata pro usuário, mas nunca deve tratar isso como sucesso —
 * a operação NÃO foi salva no CHERP/servidor ainda.
 */
export class OfflineQueuedError extends Error {
  readonly queueId: number;

  constructor(queueId: number) {
    super('Sem conexão — a alteração foi guardada e será sincronizada quando a internet voltar.');
    this.name = 'OfflineQueuedError';
    this.queueId = queueId;
  }
}
