import type { RelatorioColuna, RelatorioResultado } from '../dto/relatorio.dto.js';
import { clienteRepository, osRepository, produtoRepository, servicoRepository } from '../repositories/index.js';
import type { Permission } from '../types/auth.types.js';
import type { OSPrioridade, OSStatus } from '../types/cherp.types.js';
import { endOfDay, startOfDay } from './dashboard.service.js';
import { ValidationError } from '../errors/ValidationError.js';

export const STATUS_LABEL: Record<OSStatus, string> = {
  ABERTA: 'Em atendimento',
  EM_ANALISE: 'Em atendimento',
  EM_ANDAMENTO: 'Em atendimento',
  AGUARDANDO_PECA: 'Aguardando peças',
  AGUARDANDO_CLIENTE: 'Aguardando ret. cliente',
  CONCLUIDA: 'Pronta',
  CANCELADA: 'Encerrada',
};

export const PRIORIDADE_LABEL: Record<OSPrioridade, string> = {
  BAIXA: 'Baixa',
  NORMAL: 'Normal',
  MEDIA: 'Média',
  ALTA: 'Alta',
  URGENTE: 'Urgente',
};

/** Todas as OS lançadas via `listar()` até este limite entram na agregação — mesmo teto já aceito em `getAdminDashboard`. */
const LIMITE_OS_PARA_RELATORIO = 1000;
/** Relatório de clientes/catálogo não é paginado como a tela — teto alto só pra não deixar a consulta correr solta. */
const LIMITE_LINHAS_RELATORIO = 10_000;

function assertDentroDoLimite(total: number, tipo: string): void {
  if (total > LIMITE_LINHAS_RELATORIO) {
    throw new ValidationError(`Há ${total.toLocaleString('pt-BR')} ${tipo}. Refine os filtros para gerar um relatório completo de até 10.000 linhas.`);
  }
}

export interface RelatorioOSFiltro {
  dataInicial: Date;
  dataFinal: Date;
  dataReferencia: 'abertura' | 'conclusao';
  status?: string;
  situacaoDocumento?: number;
  prioridade?: string;
  busca?: string;
}

export interface RelatorioClientesFiltro {
  tipoPessoa?: 'PF' | 'PJ';
  uf?: string;
  busca?: string;
}

export interface RelatorioProdutosServicosFiltro {
  dataInicial: Date;
  dataFinal: Date;
  dataReferencia: 'abertura' | 'conclusao';
}

export async function gerarRelatorioOS(filtro: RelatorioOSFiltro, permissions: Permission[]): Promise<RelatorioResultado> {
  const inicio = startOfDay(filtro.dataInicial);
  const fim = endOfDay(filtro.dataFinal);
  const mostrarFinanceiro = permissions.includes('FINANCIAL_VIEW');

  let ordens = await osRepository.listarParaRelatorio({
    dataInicial: inicio,
    dataFinal: fim,
    dataReferencia: filtro.dataReferencia,
    situacaoDocumento: filtro.situacaoDocumento,
  });
  if (filtro.status === 'AGUARDANDO') {
    ordens = ordens.filter((os) => os.status === 'AGUARDANDO_PECA' || os.status === 'AGUARDANDO_CLIENTE');
  } else if (filtro.status) {
    ordens = ordens.filter((os) => os.status === filtro.status);
  }
  if (filtro.situacaoDocumento !== undefined) {
    ordens = ordens.filter((os) => os.situacaoDocumento === filtro.situacaoDocumento);
  }
  if (filtro.prioridade) {
    ordens = ordens.filter((os) => os.prioridade === filtro.prioridade);
  }
  if (filtro.busca) {
    const termo = filtro.busca.trim().toUpperCase();
    ordens = ordens.filter((os) =>
      [String(os.numero), os.clienteCodigo, os.clienteNome, os.equipamentoCodigo, os.equipamentoDescricao]
        .filter(Boolean)
        .some((campo) => campo!.toUpperCase().includes(termo)),
    );
  }
  ordens = [...ordens].sort((a, b) => new Date(a.dataAbertura).getTime() - new Date(b.dataAbertura).getTime());

  const colunas: RelatorioColuna[] = [
    { key: 'numero', label: 'Nº OS', tipo: 'numero' },
    { key: 'cliente', label: 'Cliente' },
    { key: 'veiculo', label: 'Veículo' },
    { key: 'status', label: 'Status' },
    { key: 'prioridade', label: 'Prioridade' },
    { key: 'dataAbertura', label: 'Abertura', tipo: 'data' },
    { key: 'dataConclusao', label: 'Conclusão', tipo: 'data' },
    ...(mostrarFinanceiro ? ([{ key: 'faturamento', label: 'Faturamento', tipo: 'moeda' as const, alinhamento: 'right' as const }] as RelatorioColuna[]) : []),
  ];

  const linhas = ordens.map((os) => ({
    numero: os.numero,
    cliente: os.clienteNome || os.clienteCodigo,
    veiculo: os.equipamentoDescricao || os.equipamentoCodigo,
    status: STATUS_LABEL[os.status] ?? os.status,
    prioridade: os.prioridade,
    dataAbertura: os.dataAbertura,
    dataConclusao: os.dataConclusao ?? null,
    ...(mostrarFinanceiro ? { faturamento: os.faturamento ?? null } : {}),
  }));

  return {
    titulo: 'Ordens de Serviço por período',
    geradoEm: new Date().toISOString(),
    periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
    colunas,
    linhas,
  };
}

export async function gerarRelatorioClientes(filtro: RelatorioClientesFiltro): Promise<RelatorioResultado> {
  const { items, total } = await clienteRepository.buscar({
    tipoPessoa: filtro.tipoPessoa,
    uf: filtro.uf,
    busca: filtro.busca,
    page: 1,
    limit: LIMITE_LINHAS_RELATORIO,
    sortBy: 'nome',
    sortOrder: 'asc',
  });
  assertDentroDoLimite(total, 'clientes');

  const colunas: RelatorioColuna[] = [
    { key: 'codigo', label: 'Código' },
    { key: 'nome', label: 'Nome / Razão Social' },
    { key: 'tipoPessoa', label: 'Tipo' },
    { key: 'documento', label: 'CNPJ/CPF' },
    { key: 'telefone', label: 'Telefone' },
    { key: 'cidade', label: 'Cidade/UF' },
  ];

  const linhas = items.map((c) => ({
    codigo: c.codigo,
    nome: c.nome,
    tipoPessoa: c.tipoPessoa === 'PJ' ? 'Pessoa Jurídica' : c.tipoPessoa === 'PF' ? 'Pessoa Física' : '—',
    documento: c.documento ?? null,
    telefone: c.telefone ?? null,
    cidade: c.cidade ? `${c.cidade}/${c.uf ?? ''}` : null,
  }));

  return {
    titulo: 'Clientes cadastrados',
    geradoEm: new Date().toISOString(),
    colunas,
    linhas,
  };
}

interface AgregadoItem {
  codigo: string;
  descricao: string;
  quantidade: number;
  valorTotal: number;
}

export async function gerarRelatorioProdutosServicos(
  filtro: RelatorioProdutosServicosFiltro,
  permissions: Permission[],
): Promise<RelatorioResultado> {
  const inicio = startOfDay(filtro.dataInicial);
  const fim = endOfDay(filtro.dataFinal);
  const mostrarFinanceiro = permissions.includes('FINANCIAL_VIEW');

  // listarParaDashboard() não carrega itens (leitura enxuta pro dashboard) — aqui precisamos dos
  // produtos/serviços de cada OS, então usamos listar() completo (mesmo teto de getAdminDashboard)
  // e filtramos o período em memória.
  const doPeriodo = await osRepository.listarParaRelatorio({
    dataInicial: inicio,
    dataFinal: fim,
    dataReferencia: filtro.dataReferencia,
    incluirItens: true,
  });

  const produtosMap = new Map<string, AgregadoItem>();
  const servicosMap = new Map<string, AgregadoItem>();

  for (const os of doPeriodo) {
    for (const p of os.produtos) {
      const atual = produtosMap.get(p.produtoCodigo);
      produtosMap.set(p.produtoCodigo, {
        codigo: p.produtoCodigo,
        descricao: p.descricao,
        quantidade: (atual?.quantidade ?? 0) + p.quantidade,
        valorTotal: (atual?.valorTotal ?? 0) + (p.total ?? 0),
      });
    }
    for (const s of os.servicos) {
      const atual = servicosMap.get(s.servicoCodigo);
      servicosMap.set(s.servicoCodigo, {
        codigo: s.servicoCodigo,
        descricao: s.descricao,
        quantidade: (atual?.quantidade ?? 0) + s.quantidade,
        valorTotal: (atual?.valorTotal ?? 0) + (s.total ?? 0),
      });
    }
  }

  const linhas = [
    ...[...produtosMap.values()].map((item) => ({ ...item, tipo: 'Produto' })),
    ...[...servicosMap.values()].map((item) => ({ ...item, tipo: 'Serviço' })),
  ]
    .sort((a, b) => (mostrarFinanceiro ? b.valorTotal - a.valorTotal : b.quantidade - a.quantidade))
    .map((item) => ({
      tipo: item.tipo,
      codigo: item.codigo,
      descricao: item.descricao,
      quantidade: item.quantidade,
      ...(mostrarFinanceiro ? { valorTotal: item.valorTotal } : {}),
    }));

  const colunas: RelatorioColuna[] = [
    { key: 'tipo', label: 'Tipo' },
    { key: 'codigo', label: 'Código' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'quantidade', label: 'Quantidade', tipo: 'numero', alinhamento: 'right' },
    ...(mostrarFinanceiro ? ([{ key: 'valorTotal', label: 'Valor total', tipo: 'moeda' as const, alinhamento: 'right' as const }] as RelatorioColuna[]) : []),
  ];

  return {
    titulo: 'Produtos e serviços mais lançados',
    geradoEm: new Date().toISOString(),
    periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
    colunas,
    linhas,
  };
}

export interface RelatorioCatalogoFiltro {
  busca?: string;
  tipoCodigo?: number;
  tipoModo?: 'somente' | 'exceto';
}

/** Exporta o catálogo de produtos tal como a tela de Produtos mostra — não é ranking de vendas. */
export async function gerarRelatorioCatalogoProdutos(
  filtro: RelatorioCatalogoFiltro,
  permissions: Permission[],
): Promise<RelatorioResultado> {
  const mostrarFinanceiro = permissions.includes('FINANCIAL_VIEW');
  const { items, total } = await produtoRepository.buscar({
    busca: filtro.busca,
    tipoCodigo: filtro.tipoCodigo,
    tipoModo: filtro.tipoModo,
    page: 1,
    limit: LIMITE_LINHAS_RELATORIO,
    sortBy: 'descricao',
    sortOrder: 'asc',
  });
  assertDentroDoLimite(total, 'produtos');

  const colunas: RelatorioColuna[] = [
    { key: 'codigo', label: 'Código' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'unidade', label: 'Unidade' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'categoria', label: 'Grupo Produto' },
    ...(mostrarFinanceiro ? ([{ key: 'preco', label: 'Preço', tipo: 'moeda' as const, alinhamento: 'right' as const }] as RelatorioColuna[]) : []),
    { key: 'saldo', label: 'Saldo em estoque', tipo: 'decimal', alinhamento: 'right' },
  ];

  const linhas = items.map((p) => ({
    codigo: p.codigo,
    descricao: p.descricao,
    unidade: p.unidade,
    tipo: p.tipo ?? null,
    categoria: p.categoria ?? null,
    ...(mostrarFinanceiro ? { preco: p.precoUnitario ?? null } : {}),
    saldo: p.disponivel ?? null,
  }));

  return {
    titulo: 'Catálogo de produtos',
    geradoEm: new Date().toISOString(),
    colunas,
    linhas,
  };
}

/** Exporta o catálogo de serviços tal como a tela de Serviços mostra. */
export async function gerarRelatorioCatalogoServicos(
  filtro: RelatorioCatalogoFiltro,
  permissions: Permission[],
): Promise<RelatorioResultado> {
  const mostrarFinanceiro = permissions.includes('FINANCIAL_VIEW');
  const { items, total } = await servicoRepository.buscar({
    busca: filtro.busca,
    page: 1,
    limit: LIMITE_LINHAS_RELATORIO,
    sortBy: 'descricao',
    sortOrder: 'asc',
  });
  assertDentroDoLimite(total, 'serviços');

  const colunas: RelatorioColuna[] = [
    { key: 'codigo', label: 'Código' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'categoria', label: 'Grupo Produto' },
    ...(mostrarFinanceiro ? ([{ key: 'valor', label: 'Preço', tipo: 'moeda' as const, alinhamento: 'right' as const }] as RelatorioColuna[]) : []),
  ];

  const linhas = items.map((s) => ({
    codigo: s.codigo,
    descricao: s.descricao,
    categoria: s.categoria ?? null,
    ...(mostrarFinanceiro ? { valor: s.valorUnitario ?? null } : {}),
  }));

  return {
    titulo: 'Catálogo de serviços',
    geradoEm: new Date().toISOString(),
    colunas,
    linhas,
  };
}
