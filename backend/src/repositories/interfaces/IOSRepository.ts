import type { OrdemServico } from '../../types/cherp.types.js';

export interface OSListFilter {
  status?: string;
  clienteCodigo?: string;
  tecnicoId?: string;
  page?: number;
  limit?: number;
}

export interface IOSRepository {
  buscarPorId(id: string): Promise<OrdemServico | null>;
  listar(filter: OSListFilter): Promise<{ items: OrdemServico[]; total: number }>;
  criar(os: Omit<OrdemServico, 'id' | 'numero'>): Promise<OrdemServico>;
  atualizar(id: string, patch: Partial<OrdemServico>): Promise<OrdemServico>;
}
