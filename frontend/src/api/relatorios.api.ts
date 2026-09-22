import { apiFetch, apiFetchBlob, salvarBlobComoArquivo } from './httpClient.js';

export interface RelatorioColuna {
  key: string;
  label: string;
  tipo?: 'texto' | 'numero' | 'decimal' | 'moeda' | 'data';
  alinhamento?: 'left' | 'right';
}

export type RelatorioValor = string | number | boolean | null;

export interface RelatorioResultado {
  titulo: string;
  geradoEm: string;
  periodo?: { inicio: string; fim: string };
  colunas: RelatorioColuna[];
  linhas: Record<string, RelatorioValor>[];
}

export interface RelatorioOSFiltro {
  dataInicial: string;
  dataFinal: string;
  dataReferencia?: 'abertura' | 'conclusao';
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
  dataInicial: string;
  dataFinal: string;
  dataReferencia?: 'abertura' | 'conclusao';
}

export interface RelatorioCatalogoFiltro {
  busca?: string;
  tipoCodigo?: number;
  tipoModo?: 'somente' | 'exceto';
}

function paramsOS(filtro: RelatorioOSFiltro, formato?: string): string {
  const usp = new URLSearchParams({ dataInicial: filtro.dataInicial, dataFinal: filtro.dataFinal });
  if (filtro.dataReferencia) usp.set('dataReferencia', filtro.dataReferencia);
  if (filtro.status) usp.set('status', filtro.status);
  if (filtro.situacaoDocumento !== undefined) usp.set('situacaoDocumento', String(filtro.situacaoDocumento));
  if (filtro.prioridade) usp.set('prioridade', filtro.prioridade);
  if (filtro.busca) usp.set('busca', filtro.busca);
  if (formato) usp.set('formato', formato);
  return usp.toString();
}

function paramsCatalogo(filtro: RelatorioCatalogoFiltro, formato?: string): string {
  const usp = new URLSearchParams();
  if (filtro.busca) usp.set('busca', filtro.busca);
  if (filtro.tipoCodigo !== undefined) {
    usp.set('tipoCodigo', String(filtro.tipoCodigo));
    usp.set('tipoModo', filtro.tipoModo ?? 'somente');
  }
  if (formato) usp.set('formato', formato);
  return usp.toString();
}

function paramsClientes(filtro: RelatorioClientesFiltro, formato?: string): string {
  const usp = new URLSearchParams();
  if (filtro.tipoPessoa) usp.set('tipoPessoa', filtro.tipoPessoa);
  if (filtro.uf) usp.set('uf', filtro.uf);
  if (filtro.busca) usp.set('busca', filtro.busca);
  if (formato) usp.set('formato', formato);
  return usp.toString();
}

function paramsProdutosServicos(filtro: RelatorioProdutosServicosFiltro, formato?: string): string {
  const usp = new URLSearchParams({ dataInicial: filtro.dataInicial, dataFinal: filtro.dataFinal });
  if (filtro.dataReferencia) usp.set('dataReferencia', filtro.dataReferencia);
  if (formato) usp.set('formato', formato);
  return usp.toString();
}

export const getRelatorioOS = (filtro: RelatorioOSFiltro) =>
  apiFetch<RelatorioResultado>(`/relatorios/os?${paramsOS(filtro)}`);

export const getRelatorioClientes = (filtro: RelatorioClientesFiltro) =>
  apiFetch<RelatorioResultado>(`/relatorios/clientes?${paramsClientes(filtro)}`);

export const getRelatorioProdutosServicos = (filtro: RelatorioProdutosServicosFiltro) =>
  apiFetch<RelatorioResultado>(`/relatorios/produtos-servicos?${paramsProdutosServicos(filtro)}`);

export const getRelatorioCatalogoProdutos = (filtro: RelatorioCatalogoFiltro) =>
  apiFetch<RelatorioResultado>(`/relatorios/catalogo/produtos?${paramsCatalogo(filtro)}`);

export const getRelatorioCatalogoServicos = (filtro: RelatorioCatalogoFiltro) =>
  apiFetch<RelatorioResultado>(`/relatorios/catalogo/servicos?${paramsCatalogo(filtro)}`);

type Formato = 'excel' | 'pdf';

async function baixar(path: string, nomeArquivo: string, formato: Formato) {
  const extensao = formato === 'excel' ? 'xlsx' : 'pdf';
  const blob = await apiFetchBlob(path);
  salvarBlobComoArquivo(blob, `${nomeArquivo}.${extensao}`);
}

export const baixarRelatorioOS = (filtro: RelatorioOSFiltro, formato: Formato) =>
  baixar(`/relatorios/os?${paramsOS(filtro, formato)}`, `relatorio-os-${filtro.dataInicial}-a-${filtro.dataFinal}`, formato);

export const baixarRelatorioClientes = (filtro: RelatorioClientesFiltro, formato: Formato) =>
  baixar(`/relatorios/clientes?${paramsClientes(filtro, formato)}`, 'relatorio-clientes', formato);

export const baixarRelatorioProdutosServicos = (filtro: RelatorioProdutosServicosFiltro, formato: Formato) =>
  baixar(`/relatorios/produtos-servicos?${paramsProdutosServicos(filtro, formato)}`, `relatorio-produtos-servicos-${filtro.dataInicial}-a-${filtro.dataFinal}`, formato);

export const baixarRelatorioCatalogoProdutos = (filtro: RelatorioCatalogoFiltro, formato: Formato) =>
  baixar(`/relatorios/catalogo/produtos?${paramsCatalogo(filtro, formato)}`, 'catalogo-produtos', formato);

export const baixarRelatorioCatalogoServicos = (filtro: RelatorioCatalogoFiltro, formato: Formato) =>
  baixar(`/relatorios/catalogo/servicos?${paramsCatalogo(filtro, formato)}`, 'catalogo-servicos', formato);
