import type { OrdemServico } from '../../types/cherp.types.js';

export interface OSListFilter {
  status?: string;
  clienteCodigo?: string;
  tecnicoId?: string;
  page?: number;
  limit?: number;
}

/** Leitura enxuta para indicadores: não carrega itens nem valores de uma OS. */
export interface OSDashboardFilter {
  dataInicial: Date;
  dataFinal: Date;
}

export interface IOSRepository {
  buscarPorId(id: string): Promise<OrdemServico | null>;
  listar(filter: OSListFilter): Promise<{ items: OrdemServico[]; total: number }>;
  listarParaDashboard(filter: OSDashboardFilter): Promise<OrdemServico[]>;
  buscarParaDashboard(termo: string): Promise<OrdemServico[]>;
  criar(os: Omit<OrdemServico, 'id' | 'numero'>): Promise<OrdemServico>;
  atualizar(id: string, patch: Partial<OrdemServico>): Promise<OrdemServico>;
}
