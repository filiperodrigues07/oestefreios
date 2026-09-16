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

export async function criarEquipamentoHandler(req: Request, res: Response) {
  const equipamento = await equipamentoService.criarEquipamento(req.body);
  success(res, equipamento, 'Veículo cadastrado com sucesso.', 201);
}

export async function atualizarEquipamentoHandler(req: Request, res: Response) {
  const { codigo } = req.params as { codigo: string };
  const equipamento = await equipamentoService.atualizarEquipamento(codigo, req.body);
  success(res, equipamento, 'Veículo atualizado com sucesso.');
}
