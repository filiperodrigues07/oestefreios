import type { Request, Response } from 'express';
import * as osService from '../services/os.service.js';
import { success } from '../utils/apiResponse.js';

function requestContext(req: Request) {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

export async function listOSHandler(req: Request, res: Response) {
  const filter = req.query as unknown as {
    status?: string;
    clienteCodigo?: string;
    tecnicoId?: string;
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
  const { produtoCodigo, quantidade } = req.body as { produtoCodigo: string; quantidade: number };
  const os = await osService.adicionarProdutoOS(id, produtoCodigo, quantidade, req.user!, requestContext(req));
  success(res, os, 'Produto adicionado.');
}

export async function removerProdutoHandler(req: Request, res: Response) {
  const { id, produtoCodigo } = req.params as { id: string; produtoCodigo: string };
  const os = await osService.removerProdutoOS(id, produtoCodigo, req.user!, requestContext(req));
  success(res, os, 'Produto removido.');
}

export async function adicionarServicoHandler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const { servicoCodigo, quantidade } = req.body as { servicoCodigo: string; quantidade: number };
  const os = await osService.adicionarServicoOS(id, servicoCodigo, quantidade, req.user!, requestContext(req));
  success(res, os, 'Serviço adicionado.');
}

export async function removerServicoHandler(req: Request, res: Response) {
  const { id, servicoCodigo } = req.params as { id: string; servicoCodigo: string };
  const os = await osService.removerServicoOS(id, servicoCodigo, req.user!, requestContext(req));
  success(res, os, 'Serviço removido.');
}
