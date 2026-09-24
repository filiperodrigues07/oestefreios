import type { OrdemServico } from '../../types/cherp.types.js';

export interface OSListFilter {
  status?: string;
  situacaoDocumento?: number;
  /** Inclui as OS prontas e encerradas. A tela de OS usa essa visão completa; o dashboard mantém apenas abertas. */
  incluirFinalizadas?: boolean;
  clienteCodigo?: string;
  tecnicoId?: string;
  prioridade?: string;
  /** Busca livre — casa contra número da OS, código/nome do cliente, código/placa/descrição do veículo. */
  busca?: string;
  /** Período de abertura (ORDEMSERVICO.DATA) — ambos opcionais e combináveis entre si. */
  dataInicial?: Date;
  dataFinal?: Date;
  sortBy?: 'numero' | 'clienteNome' | 'equipamentoDescricao' | 'dataAbertura' | 'status' | 'prioridade' | 'faturamento';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/** Leitura enxuta para indicadores: não carrega itens nem valores de uma OS. */
export interface OSDashboardFilter {
  dataInicial: Date;
  dataFinal: Date;
}

/** Consulta histórica de relatórios: escolhe explicitamente se o período considera abertura ou conclusão. */
export interface OSReportFilter extends OSDashboardFilter {
  dataReferencia: 'abertura' | 'conclusao';
  incluirItens?: boolean;
  situacaoDocumento?: number;
}

export interface OSItemPatch {
  quantidade?: number;
  precoUnitario?: number;
  descricaoComplementar?: string;
}

export interface OSImagemMeta {
  identificador: string;
  descricao: string;
  nomeArquivo: string;
  data: string;
}

export interface OSImagemNova {
  buffer: Buffer;
  nomeArquivo: string;
  descricao?: string;
}

export interface OSImagemArquivo {
  buffer: Buffer;
  nomeArquivo: string;
}

export interface IOSRepository {
  buscarPorId(id: string): Promise<OrdemServico | null>;
  listar(filter: OSListFilter): Promise<{ items: OrdemServico[]; total: number }>;
  /** Cabeçalhos de todas as OS (ou de uma situação nativa), sem itens e sem corte de paginação. */
  listarCabecalhos(situacaoDocumento?: number): Promise<OrdemServico[]>;
  listarParaDashboard(filter: OSDashboardFilter): Promise<OrdemServico[]>;
  listarParaRelatorio(filter: OSReportFilter): Promise<OrdemServico[]>;
  buscarParaDashboard(termo: string): Promise<OrdemServico[]>;
  criar(os: Omit<OrdemServico, 'id' | 'numero'>): Promise<OrdemServico>;
  atualizar(id: string, patch: Partial<OrdemServico>): Promise<OrdemServico>;
  /** Exclusão lógica (ATIVO = 0) — o CHERP nunca apaga linha de verdade; a OS some das listagens. */
  excluir(id: string): Promise<void>;
  /** Edita quantidade/preço de um item já lançado (UPDATE isolado — não passa pelo diff de sincronizarItens). */
  atualizarItemProduto(id: string, produtoCodigo: string, patch: OSItemPatch): Promise<OrdemServico>;
  atualizarItemServico(id: string, servicoCodigo: string, patch: OSItemPatch): Promise<OrdemServico>;
  /** Fotos da OS — ORDEMSERVICOIMG, BLOB nativo do CHERP (não é armazenamento paralelo). */
  listarImagens(id: string): Promise<OSImagemMeta[]>;
  adicionarImagem(id: string, imagem: OSImagemNova): Promise<void>;
  buscarImagem(id: string, identificador: string): Promise<OSImagemArquivo | null>;
  removerImagem(id: string, identificador: string): Promise<void>;
}
