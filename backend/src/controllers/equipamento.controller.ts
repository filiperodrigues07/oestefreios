import type { Request, Response } from 'express';
import * as equipamentoService from '../services/equipamento.service.js';
import { success } from '../utils/apiResponse.js';
import { requestContext } from '../utils/requestContext.js';

export async function searchEquipamentosHandler(req: Request, res: Response) {
  const query = req.query as unknown as {
    codigo?: string;
    descricao?: string;
    clienteCodigo?: string;
    anoFabricacao?: number;
    page: number;
    limit: number;
    sortBy?: 'identificacao' | 'descricao' | 'ano' | 'cliente';
    sortOrder?: 'asc' | 'desc';
  };
  const result = await equipamentoService.searchEquipamentos(query);
  success(res, result);
}

export async function getEquipamentoByCodigoHandler(req: Request, res: Response) {
  const { codigo } = req.params as { codigo: string };
  const equipamento = await equipamentoService.getEquipamentoByCodigo(codigo);
  success(res, equipamento);
}

export async function criarEquipamentoHandler(req: Request, res: Response) {
  const equipamento = await equipamentoService.criarEquipamento(req.body, req.user!, requestContext(req));
  success(res, equipamento, 'Veículo cadastrado com sucesso.', 201);
}

export async function atualizarEquipamentoHandler(req: Request, res: Response) {
  const { codigo } = req.params as { codigo: string };
  const equipamento = await equipamentoService.atualizarEquipamento(codigo, req.body, req.user!, requestContext(req));
  success(res, equipamento, 'Veículo atualizado com sucesso.');
}
