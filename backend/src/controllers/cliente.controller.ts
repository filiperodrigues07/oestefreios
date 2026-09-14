import type { Request, Response } from 'express';
import * as clienteService from '../services/cliente.service.js';
import { success } from '../utils/apiResponse.js';

export async function searchClientesHandler(req: Request, res: Response) {
  const query = req.query as unknown as { codigo?: string; descricao?: string; page: number; limit: number };
  const result = await clienteService.searchClientes(query);
  success(res, result);
}

export async function getClienteByCodigoHandler(req: Request, res: Response) {
  const { codigo } = req.params as { codigo: string };
  const cliente = await clienteService.getClienteByCodigo(codigo);
  success(res, cliente);
}
