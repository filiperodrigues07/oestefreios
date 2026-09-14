import type { Request, Response } from 'express';
import * as servicoService from '../services/servico.service.js';
import { success } from '../utils/apiResponse.js';

export async function searchServicosHandler(req: Request, res: Response) {
  const query = req.query as unknown as { codigo?: string; descricao?: string; page: number; limit: number };
  const result = await servicoService.searchServicos(query, req.user!.permissions);
  success(res, result);
}

export async function getServicoByCodigoHandler(req: Request, res: Response) {
  const { codigo } = req.params as { codigo: string };
  const servico = await servicoService.getServicoByCodigo(codigo, req.user!.permissions);
  success(res, servico);
}
