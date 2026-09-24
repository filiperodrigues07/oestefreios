import type { Cliente, ClienteInput, PaginatedResult, SearchQuery, VinculosCadastro } from '../../types/cherp.types.js';

export interface IClienteRepository {
  buscarPorCodigo(codigo: string): Promise<Cliente | null>;
  buscarPorNome(nome: string): Promise<Cliente[]>;
  buscarPorDocumento(documento: string): Promise<Cliente | null>;
  buscar(query: SearchQuery): Promise<PaginatedResult<Cliente>>;
  criar(input: ClienteInput): Promise<Cliente>;
  atualizar(codigo: string, input: ClienteInput): Promise<Cliente>;
  /** Exclusão lógica (ATIVO = 0). Devolve false, sem alterar nada, se houver vínculos ou o cadastro já não existir. */
  excluir(codigo: string): Promise<boolean>;
  contarVinculos(codigo: string): Promise<VinculosCadastro>;
}
