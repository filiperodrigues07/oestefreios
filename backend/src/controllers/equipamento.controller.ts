import type { Request, Response } from 'express';
import * as equipamentoService from '../services/equipamento.service.js';
import { success } from '../utils/apiResponse.js';

export async function searchEquipamentosHandler(req: Request, res: Response) {
  const query = req.query as unknown as {
    codigo?: string;
    descricao?: string;
    clienteCodigo?: string;
    page: number;
    limit: number;
  };
  const result = await equipamentoService.searchEquipamentos(query);
  success(res, result);
}

export async function getEquipamentoByCodigoHandler(req: Request, res: Response) {
  const { codigo } = req.params as { codigo: string };
  const equipamento = await equipamentoService.getEquipamentoByCodigo(codigo);
  success(res, equipamento);
}
