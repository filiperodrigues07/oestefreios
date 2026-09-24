/**
 * Entidades do domínio CHERP/Firebird. `codigo` é sempre string: o CHERP
 * usa códigos com zeros à esquerda (ex. "00012345") que não podem virar number.
 */

export interface Produto {
  codigo: string;
  descricao: string;
  unidade: string;
  categoria?: string;
  /** PRODUTO.TIPO resolvido via PRODUTOTIPO (Mercadoria pra Revenda, Matéria-Prima, Material de Uso e Consumo, etc). */
  tipo?: string;
  disponivel?: number;
  estoqueMinimo?: number;
  precoUnitario?: number;
  custo?: number;
}

export interface Servico {
  codigo: string;
  descricao: string;
  unidade: string;
  categoria?: string;
  tipoServicoCodigo?: string;
  tipoServicoDescricao?: string;
  valorUnitario?: number;
}

export type TipoPessoa = 'PF' | 'PJ';

export interface Cliente {
  codigo: string;
  ativo?: boolean;
  /** Nome de exibição — fantasia se houver, senão razão social/nome completo. Uso em listas/busca. */
  nome: string;
  documento?: string;
  telefone?: string;
  celular?: string;
  tipoPessoa?: TipoPessoa;
  /** Razão social (PJ) ou nome completo (PF) — bruto, sem coalescer com fantasia. Uso em formulário de edição. */
  razaoSocial?: string;
  nomeFantasia?: string;
  email?: string;
  emailFinanceiro?: string;
  emailNfe?: string;
  homePage?: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  reducaoMva?: number;
  coreRepresentante?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  complemento?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  /** CLIFOR também marca fornecedor/transportador/representante de forma independente de cliente (Fase A0). */
  fornecedor?: boolean;
  transportador?: boolean;
  representante?: boolean;
  /** CRT (Código de Regime Tributário) padrão SEFAZ/NFe: 1=Simples Nacional, 2=Simples excesso sublimite, 3=Regime Normal. 0/undefined=não definido. */
  regimeTributario?: RegimeTributario;
}

export type RegimeTributario = 0 | 1 | 2 | 3;

/** Entrada pra criar/editar cliente — `documento` sempre exigido (CPF ou CNPJ conforme `tipoPessoa`). */
export interface ClienteInput {
  ativo?: boolean;
  tipoPessoa: TipoPessoa;
  nome: string;
  nomeFantasia?: string;
  documento: string;
  telefone?: string;
  celular?: string;
  email?: string;
  emailFinanceiro?: string;
  emailNfe?: string;
  homePage?: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  reducaoMva?: number;
  coreRepresentante?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  complemento?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  fornecedor?: boolean;
  transportador?: boolean;
  representante?: boolean;
  regimeTributario?: RegimeTributario;
  /** Metadado transitório usado apenas para atribuir a criação no CHERP. */
  cherpUsuarioChave?: number;
}

export interface Equipamento {
  codigo: string;
  descricao: string;
  clienteCodigo: string;
  clienteNome?: string;
  /** Placa do veículo — nome de campo espelha a coluna IDENTIFICACAO do CHERP. */
  identificacao?: string;
  marca?: string;
  modelo?: string;
  anoFabricacao?: string;
  anoModelo?: string;
  cor?: string;
  chassi?: string;
  kmAtual?: number;
}

/** Entrada pra criar/editar veículo. `placa` é o nome exibido na UI pro campo `identificacao`. */
export interface EquipamentoInput {
  clienteCodigo: string;
  placa: string;
  marca?: string;
  modelo?: string;
  anoFabricacao?: string;
  anoModelo?: string;
  cor?: string;
  chassi?: string;
  kmAtual?: number;
  versao?: string;
  combustivel?: string;
  municipio?: string;
  uf?: string;
  motor?: string;
  codigoFipe?: string;
}

export type OSStatus =
  | 'ABERTA'
  | 'EM_ANALISE'
  | 'EM_ANDAMENTO'
  | 'AGUARDANDO_PECA'
  | 'AGUARDANDO_CLIENTE'
  | 'CONCLUIDA'
  | 'CANCELADA';

export type OSPrioridade = 'BAIXA' | 'NORMAL' | 'MEDIA' | 'ALTA' | 'URGENTE';

export interface OSItemProduto {
  produtoCodigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  precoUnitario?: number;
  desconto?: number;
  total?: number;
  /** ITENSORDEMSERVICOPROD.DESCRCOMPLEMENT — texto livre que só o cliente preenche no lançamento. */
  descricaoComplementar?: string;
}

export interface OSItemServico {
  servicoCodigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  valorUnitario?: number;
  desconto?: number;
  total?: number;
  /** ITENSORDEMSERVICOSERV.DESCRCOMPLEMENT — texto livre que só o cliente preenche no lançamento. */
  descricaoComplementar?: string;
}

export interface OSHistoricoEntry {
  timestamp: string;
  evento: string;
  usuarioNome: string;
}

export interface OrdemServico {
  id: string;
  numero: number;
  clienteCodigo: string;
  clienteNome?: string;
  equipamentoCodigo: string;
  equipamentoDescricao?: string;
  status: OSStatus;
  prioridade: OSPrioridade;
  responsavelId?: string;
  tecnicoId?: string;
  problema: string;
  diagnostico?: string;
  observacoes?: string;
  solucao?: string;
  produtos: OSItemProduto[];
  servicos: OSItemServico[];
  historico: OSHistoricoEntry[];
  dataAbertura: string;
  dataPrevista?: string;
  dataConclusao?: string;
  /** Situação principal do documento no CHERP (ORDEMSERVICO.SITUACAO). Somente 0 (Aberta) permite edição. */
  situacaoDocumento?: number;
  /** "Finalizar OS" pelo app (os_workflow.travado_local) — trava edição só aqui, nunca mexe no CHERP. */
  travadoLocal?: boolean;
  faturamento?: number;
  /** Nº do DAV impresso no CHERP (ORDEMSERVICO.NRODAV) — só leitura, o CHERP quem gera. */
  nroDav?: string;
  /** KM do veículo na abertura/entrega (ORDEMSERVICO.KMATUAL/KMFINAL) — editável pelo app. */
  kmAtual?: number;
  kmFinal?: number;
  /** Frete e IPI da OS (ORDEMSERVICO.FRETE/TOTALIPI) — só leitura, financeiro. */
  frete?: number;
  totalIpi?: number;
  /** Metadado transitório de escrita: usuário do CHERP vinculado ao autor da ação. */
  cherpUsuarioChave?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface SearchQuery {
  tipoCodigo?: number;
  /** Código de PRODTIPOSERV, usado somente no catálogo de serviços. */
  tipoServicoCodigo?: string;
  tipoModo?: 'somente' | 'exceto';
  /** Só usado por produtos: filtra pelo saldo em estoque (PRODUTOESTOQUE.SALDO somado). */
  saldoModo?: 'todos' | 'com_saldo' | 'sem_saldo' | 'negativo';
  codigo?: string;
  descricao?: string;
  /** Só usado por equipamentos: filtra pelo cliente já selecionado no fluxo de criação de OS. */
  clienteCodigo?: string;
  anoFabricacao?: number;
  /** Só usado por clientes. */
  tipoPessoa?: TipoPessoa;
  uf?: string;
  /** Busca livre — clientes: código/nome/documento/telefone. Produtos/serviços: código/descrição/categoria. */
  busca?: string;
  page?: number;
  limit?: number;
  sortBy?: 'codigo' | 'descricao' | 'nome' | 'documento' | 'telefone' | 'cidade' | 'categoria' | 'tipo' | 'identificacao' | 'ano' | 'cliente';
  sortOrder?: 'asc' | 'desc';
}

/** O que impede excluir um cliente/veiculo: registros ligados a ele (ver repositories/firebird/vinculosCadastro.ts). */
export interface VinculosCadastro {
  os: number;
  veiculos: number;
  financeiro: number;
  fiscal: number;
  pedidos: number;
  outros: number;
}
