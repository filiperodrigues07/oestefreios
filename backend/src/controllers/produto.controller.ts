import type { Request, Response } from 'express';
import * as produtoService from '../services/produto.service.js';
import { success } from '../utils/apiResponse.js';

export async function searchProdutosHandler(req: Request, res: Response) {
  const query = req.query as unknown as { codigo?: string; descricao?: string; page: number; limit: number };
  const result = await produtoService.searchProdutos(query, req.user!.permissions);
  success(res, result);
}

export async function getProdutoByCodigoHandler(req: Request, res: Response) {
  const { codigo } = req.params as { codigo: string };
  const produto = await produtoService.getProdutoByCodigo(codigo, req.user!.permissions);
  success(res, produto);
}
