import type { Request, Response } from 'express';
import * as relatorioService from '../services/relatorio.service.js';
import { exportarExcel, exportarPdf } from '../services/reportExport.service.js';
import { getGeralSettings } from '../services/settings.service.js';
import { success } from '../utils/apiResponse.js';
import { resolverLogoParaPdf } from '../utils/brandingAssets.js';
import type { RelatorioResultado } from '../dto/relatorio.dto.js';

type Formato = 'json' | 'excel' | 'pdf';

async function enviarResultado(res: Response, relatorio: RelatorioResultado, formato: Formato, nomeArquivo: string) {
  if (formato === 'json') {
    success(res, relatorio);
    return;
  }

  const geral = await getGeralSettings();

  if (formato === 'excel') {
    const branding = { nomeEmpresa: geral.nomeEmpresa, logoUrl: geral.logoUrl, corDestaque: geral.corDestaque };
    const buffer = await exportarExcel(relatorio, branding);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}.xlsx"`);
    res.send(buffer);
    return;
  }

  const branding = { nomeEmpresa: geral.nomeEmpresa, logoUrl: await resolverLogoParaPdf(geral.logoUrl), corDestaque: geral.corDestaque };
  const buffer = await exportarPdf(relatorio, branding);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}.pdf"`);
  res.send(buffer);
}

export async function relatorioOSHandler(req: Request, res: Response) {
  const { dataInicial, dataFinal, dataReferencia, status, situacaoDocumento, prioridade, busca, formato } = req.query as unknown as {
    dataInicial: Date;
    dataFinal: Date;
    dataReferencia: 'abertura' | 'conclusao';
    status?: string;
    situacaoDocumento?: number;
    prioridade?: string;
    busca?: string;
    formato: Formato;
  };
  const relatorio = await relatorioService.gerarRelatorioOS({ dataInicial, dataFinal, dataReferencia, status, situacaoDocumento, prioridade, busca }, req.user!.permissions);
  await enviarResultado(res, relatorio, formato, 'relatorio-os');
}

export async function relatorioClientesHandler(req: Request, res: Response) {
  const { tipoPessoa, uf, busca, formato } = req.query as unknown as {
    tipoPessoa?: 'PF' | 'PJ';
    uf?: string;
    busca?: string;
    formato: Formato;
  };
  const relatorio = await relatorioService.gerarRelatorioClientes({ tipoPessoa, uf, busca });
  await enviarResultado(res, relatorio, formato, 'relatorio-clientes');
}

export async function relatorioProdutosServicosHandler(req: Request, res: Response) {
  const { dataInicial, dataFinal, dataReferencia, formato } = req.query as unknown as {
    dataInicial: Date;
    dataFinal: Date;
    dataReferencia: 'abertura' | 'conclusao';
    formato: Formato;
  };
  const relatorio = await relatorioService.gerarRelatorioProdutosServicos({ dataInicial, dataFinal, dataReferencia }, req.user!.permissions);
  await enviarResultado(res, relatorio, formato, 'relatorio-produtos-servicos');
}

export async function relatorioCatalogoProdutosHandler(req: Request, res: Response) {
  const { busca, tipoCodigo, tipoModo, saldoModo, formato } = req.query as unknown as { busca?: string; tipoCodigo?: number; tipoModo?: 'somente' | 'exceto'; saldoModo?: 'todos' | 'com_saldo' | 'sem_saldo' | 'negativo'; formato: Formato };
  const relatorio = await relatorioService.gerarRelatorioCatalogoProdutos({ busca, tipoCodigo, tipoModo, saldoModo }, req.user!.permissions);
  await enviarResultado(res, relatorio, formato, 'catalogo-produtos');
}

export async function relatorioCatalogoServicosHandler(req: Request, res: Response) {
  const { busca, formato } = req.query as unknown as { busca?: string; formato: Formato };
  const relatorio = await relatorioService.gerarRelatorioCatalogoServicos({ busca }, req.user!.permissions);
  await enviarResultado(res, relatorio, formato, 'catalogo-servicos');
}
