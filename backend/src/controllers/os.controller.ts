import type { Request, Response } from 'express';
import { ValidationError } from '../errors/ValidationError.js';
import * as osService from '../services/os.service.js';
import { exportarOSPdf } from '../services/reportExport.service.js';
import { getGeralSettings } from '../services/settings.service.js';
import { success } from '../utils/apiResponse.js';
import { resolverLogoParaPdf } from '../utils/brandingAssets.js';
import { detectarTipoImagem } from '../utils/imageSignature.js';
import { requestContext } from '../utils/requestContext.js';

export async function listOSHandler(req: Request, res: Response) {
  const filter = req.query as unknown as {
    status?: string;
    situacaoDocumento?: number;
    incluirFinalizadas?: boolean;
    clienteCodigo?: string;
    tecnicoId?: string;
    prioridade?: string;
    busca?: string;
    sortBy?: 'numero' | 'clienteNome' | 'equipamentoDescricao' | 'dataAbertura' | 'status' | 'prioridade' | 'faturamento';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  };
  const result = await osService.listOS(filter, req.user!.permissions);
  success(res, result);
}

export async function getOSByIdHandler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const os = await osService.getOSById(id, req.user!.permissions);
  success(res, os);
}

/** PDF de impressão de uma OS — mesma permissão de leitura da OS (OS_VIEW, já aplicada no router). */
export async function getOSPdfHandler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const os = await osService.getOSById(id, req.user!.permissions);
  const geral = await getGeralSettings();
  const branding = { nomeEmpresa: geral.nomeEmpresa, logoUrl: await resolverLogoParaPdf(geral.logoUrl), corDestaque: geral.corDestaque };
  const buffer = await exportarOSPdf(os, branding);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="os-${os.numero}.pdf"`);
  res.send(buffer);
}

export async function criarOSHandler(req: Request, res: Response) {
  const os = await osService.criarOS(req.body, req.user!, requestContext(req));
  success(res, os, 'OS criada com sucesso.', 201);
}

export async function atualizarOSHandler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const os = await osService.atualizarOS(id, req.body, req.user!, requestContext(req));
  success(res, os, 'Alterações salvas.');
}

export async function alterarStatusHandler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const { status } = req.body as { status: Parameters<typeof osService.alterarStatusOS>[1] };
  const os = await osService.alterarStatusOS(id, status, req.user!, requestContext(req));
  success(res, os, 'Status alterado.');
}

export async function adicionarProdutoHandler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const { produtoCodigo, quantidade, precoUnitario, descricaoComplementar } = req.body as {
    produtoCodigo: string;
    quantidade: number;
    precoUnitario?: number;
    descricaoComplementar?: string;
  };
  const os = await osService.adicionarProdutoOS(
    id,
    produtoCodigo,
    quantidade,
    req.user!,
    requestContext(req),
    precoUnitario,
    descricaoComplementar,
  );
  success(res, os, 'Produto adicionado.');
}

export async function removerProdutoHandler(req: Request, res: Response) {
  const { id, produtoCodigo } = req.params as { id: string; produtoCodigo: string };
  const os = await osService.removerProdutoOS(id, produtoCodigo, req.user!, requestContext(req));
  success(res, os, 'Produto removido.');
}

export async function atualizarProdutoItemHandler(req: Request, res: Response) {
  const { id, produtoCodigo } = req.params as { id: string; produtoCodigo: string };
  const { quantidade, precoUnitario, descricaoComplementar } = req.body as {
    quantidade?: number;
    precoUnitario?: number;
    descricaoComplementar?: string;
  };
  const os = await osService.atualizarProdutoOS(
    id,
    produtoCodigo,
    { quantidade, precoUnitario, descricaoComplementar },
    req.user!,
    requestContext(req),
  );
  success(res, os, 'Produto atualizado.');
}

export async function adicionarServicoHandler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const { servicoCodigo, quantidade, valorUnitario, descricaoComplementar } = req.body as {
    servicoCodigo: string;
    quantidade: number;
    valorUnitario?: number;
    descricaoComplementar?: string;
  };
  const os = await osService.adicionarServicoOS(
    id,
    servicoCodigo,
    quantidade,
    req.user!,
    requestContext(req),
    valorUnitario,
    descricaoComplementar,
  );
  success(res, os, 'Serviço adicionado.');
}

export async function removerServicoHandler(req: Request, res: Response) {
  const { id, servicoCodigo } = req.params as { id: string; servicoCodigo: string };
  const os = await osService.removerServicoOS(id, servicoCodigo, req.user!, requestContext(req));
  success(res, os, 'Serviço removido.');
}

export async function atualizarServicoItemHandler(req: Request, res: Response) {
  const { id, servicoCodigo } = req.params as { id: string; servicoCodigo: string };
  const { quantidade, precoUnitario, descricaoComplementar } = req.body as {
    quantidade?: number;
    precoUnitario?: number;
    descricaoComplementar?: string;
  };
  const os = await osService.atualizarServicoOS(
    id,
    servicoCodigo,
    { quantidade, precoUnitario, descricaoComplementar },
    req.user!,
    requestContext(req),
  );
  success(res, os, 'Serviço atualizado.');
}

export async function listarImagensHandler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const imagens = await osService.listarImagensOS(id);
  success(res, imagens);
}

export async function adicionarImagemHandler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  if (!req.file) {
    throw new ValidationError('Envie um arquivo de imagem.');
  }
  const { descricao } = req.body as { descricao?: string };
  const imagens = await osService.adicionarImagemOS(
    id,
    { buffer: req.file.buffer, nomeArquivo: req.file.originalname, descricao },
    req.user!,
    requestContext(req),
  );
  success(res, imagens, 'Imagem enviada.');
}

export async function removerImagemHandler(req: Request, res: Response) {
  const { id, identificador } = req.params as { id: string; identificador: string };
  const imagens = await osService.removerImagemOS(id, identificador, req.user!, requestContext(req));
  success(res, imagens, 'Imagem removida.');
}

export async function buscarImagemHandler(req: Request, res: Response) {
  const { id, identificador } = req.params as { id: string; identificador: string };
  const imagem = await osService.buscarImagemOS(id, identificador);
  const tipo = detectarTipoImagem(imagem.buffer);
  res.setHeader('Content-Type', tipo?.mime ?? 'application/octet-stream');
  res.send(imagem.buffer);
}
