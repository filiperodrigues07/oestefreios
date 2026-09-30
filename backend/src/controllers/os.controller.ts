import type { Request, Response } from 'express';
import { ValidationError } from '../errors/ValidationError.js';
import * as osService from '../services/os.service.js';
import { exportarOSPdf, type OSFotoPdf } from '../services/reportExport.service.js';
import { getGeralSettings } from '../services/settings.service.js';
import { success } from '../utils/apiResponse.js';
import { resolverLogoParaPdf } from '../utils/brandingAssets.js';
import { criarBytesLruCache } from '../utils/bytesLruCache.js';
import { detectarTipoImagem } from '../utils/imageSignature.js';
import { gerarMiniaturaOS } from '../utils/osImagePreview.js';
import { fotoParaPdf, mapearComLimite } from '../utils/osPhotoPdf.js';
import { requestContext } from '../utils/requestContext.js';

export async function listOSHandler(req: Request, res: Response) {
  const filter = req.query as unknown as {
    status?: string;
    situacaoDocumento?: number;
    incluirFinalizadas?: boolean;
    somenteFinalizadasApp?: boolean;
    situacaoAtendimento?: string;
    clienteCodigo?: string;
    tecnicoId?: string;
    prioridade?: string;
    busca?: string;
    dataInicial?: Date;
    dataFinal?: Date;
    sortBy?:
      | 'numero'
      | 'clienteNome'
      | 'equipamentoDescricao'
      | 'dataAbertura'
      | 'status'
      | 'prioridade'
      | 'faturamento';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  };
  const result = await osService.listOS(filter, req.user!.permissions, req.user!.id);
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
  const branding = {
    nomeEmpresa: geral.nomeEmpresa,
    logoUrl: await resolverLogoParaPdf(geral.logoUrl),
    corDestaque: geral.corDestaque,
  };
  // BLOB do Firebird é o gargalo: 3 fotos por vez (pool tem 10 conexões) em vez de uma a uma.
  // A OS já foi validada acima, então busca direto do repositório sem reconsultar a OS por foto.
  const fotos: OSFotoPdf[] = await mapearComLimite(await osService.listarImagensOS(id), 3, async (meta) => {
    try {
      const arquivo = await osService.buscarImagemOSJaValidada(id, meta.identificador);
      return { ...meta, src: await fotoParaPdf(arquivo.buffer) };
    } catch {
      throw new ValidationError(`Não foi possível incluir a foto "${meta.nomeArquivo}" no PDF. Verifique o arquivo e tente novamente.`);
    }
  });
  const buffer = await exportarOSPdf(os, branding, fotos);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="os-${os.numero}.pdf"`);
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

export async function trocarVinculoOSHandler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const os = await osService.trocarVinculoOS(id, req.body, req.user!, requestContext(req));
  success(res, os, 'Cliente/veículo da OS atualizados.');
}

export async function duplicarOSHandler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const os = await osService.duplicarOS(id, req.user!, req.body as { kmAtual: number; kmFinal: number }, requestContext(req));
  success(res, os, 'OS duplicada com sucesso.', 201);
}

export async function reabrirOSHandler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const { motivo } = req.body as { motivo: string };
  const os = await osService.reabrirOS(id, motivo, req.user!, requestContext(req));
  success(res, os, 'OS reaberta.');
}

export async function excluirOSHandler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const { motivo } = req.body as { motivo: string };
  await osService.excluirOS(id, motivo, req.user!, requestContext(req));
  success(res, null, 'OS excluída.');
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

function itemIdDaRequisicao(req: Request): number | undefined {
  if (req.query.itemId === undefined) return undefined;
  const id = Number(req.query.itemId);
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new ValidationError('Identificador da linha inválido.');
  return id;
}

export async function removerProdutoHandler(req: Request, res: Response) {
  const { id, produtoCodigo } = req.params as { id: string; produtoCodigo: string };
  const os = await osService.removerProdutoOS(
    id,
    produtoCodigo,
    req.user!,
    requestContext(req),
    itemIdDaRequisicao(req),
  );
  success(res, os, 'Produto removido.');
}

export async function restaurarProdutoHandler(req: Request, res: Response) {
  const { id, produtoCodigo } = req.params as { id: string; produtoCodigo: string };
  const os = await osService.restaurarItemOS(
    id,
    'produto',
    produtoCodigo,
    req.user!,
    requestContext(req),
    itemIdDaRequisicao(req),
  );
  success(res, os, 'Produto restaurado.');
}

export async function restaurarServicoHandler(req: Request, res: Response) {
  const { id, servicoCodigo } = req.params as { id: string; servicoCodigo: string };
  const os = await osService.restaurarItemOS(
    id,
    'servico',
    servicoCodigo,
    req.user!,
    requestContext(req),
    itemIdDaRequisicao(req),
  );
  success(res, os, 'Serviço restaurado.');
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
    itemIdDaRequisicao(req),
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
  const os = await osService.removerServicoOS(
    id,
    servicoCodigo,
    req.user!,
    requestContext(req),
    itemIdDaRequisicao(req),
  );
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
    itemIdDaRequisicao(req),
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
  const imagens = await osService.removerImagemOS(
    id,
    identificador,
    req.user!,
    requestContext(req),
  );
  cacheMiniaturasOS.remover(`${id}:${identificador}`);
  success(res, imagens, 'Imagem removida.');
}

/**
 * Foto da OS tem IDENTIFICADOR próprio e o conteúdo dela nunca muda (remover = ATIVO 0), então
 * miniatura pronta fica em memória (teto de bytes) e o navegador pode guardar a resposta. A permissão
 * continua sendo checada na rota antes deste handler; remover a foto limpa o cache do servidor.
 */
const cacheMiniaturasOS = criarBytesLruCache(64 * 1024 * 1024);
const CACHE_FOTO_OS = 'private, max-age=3600';

export async function buscarImagemHandler(req: Request, res: Response) {
  const { id, identificador } = req.params as { id: string; identificador: string };
  res.setHeader('Cache-Control', CACHE_FOTO_OS); // sobrepõe o no-store global de /api só pra foto
  if (req.query.preview === '1') {
    const chave = `${id}:${identificador}`;
    let miniatura = cacheMiniaturasOS.obter(chave);
    if (!miniatura) {
      const imagem = await osService.buscarImagemOS(id, identificador);
      miniatura = await gerarMiniaturaOS(imagem.buffer);
      cacheMiniaturasOS.guardar(chave, miniatura);
    }
    res.setHeader('Content-Type', 'image/webp');
    res.send(miniatura);
    return;
  }
  const imagem = await osService.buscarImagemOS(id, identificador);
  const tipo = detectarTipoImagem(imagem.buffer);
  res.setHeader('Content-Type', tipo?.mime ?? 'application/octet-stream');
  res.send(imagem.buffer);
}
