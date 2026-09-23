import type { Request, Response } from 'express';
import * as clienteService from '../services/cliente.service.js';
import { success } from '../utils/apiResponse.js';
import { requestContext } from '../utils/requestContext.js';

export async function searchClientesHandler(req: Request, res: Response) {
  const query = req.query as unknown as {
    codigo?: string;
    descricao?: string;
    tipoPessoa?: 'PF' | 'PJ';
    uf?: string;
    busca?: string;
    sortBy?: 'codigo' | 'descricao' | 'nome' | 'documento' | 'telefone' | 'cidade';
    sortOrder?: 'asc' | 'desc';
    page: number;
    limit: number;
  };
  const result = await clienteService.searchClientes(query);
  success(res, result);
}

export async function getClienteByCodigoHandler(req: Request, res: Response) {
  const { codigo } = req.params as { codigo: string };
  const cliente = await clienteService.getClienteByCodigo(codigo);
  success(res, cliente);
}

export async function getClienteByDocumentoHandler(req: Request, res: Response) {
  const { documento } = req.params as { documento: string };
  const cliente = await clienteService.getClienteByDocumento(documento);
  success(res, cliente);
}

export async function criarClienteHandler(req: Request, res: Response) {
  const cliente = await clienteService.criarCliente(req.body, req.user!, requestContext(req));
  success(res, cliente, 'Cliente cadastrado com sucesso.', 201);
}

export async function atualizarClienteHandler(req: Request, res: Response) {
  const { codigo } = req.params as { codigo: string };
  const cliente = await clienteService.atualizarCliente(codigo, req.body, req.user!, requestContext(req));
  success(res, cliente, 'Cliente atualizado com sucesso.');
}

export async function consultarCnpjHandler(req: Request, res: Response) {
  const { cnpj } = req.params as unknown as { cnpj: string };
  const dados = await clienteService.consultarCnpj(cnpj);
  success(res, dados);
}

export async function consultarCepHandler(req: Request, res: Response) {
  const { cep } = req.params as unknown as { cep: string };
  const dados = await clienteService.consultarCep(cep);
  success(res, dados);
}

export async function consultarInscricaoEstadualHandler(req: Request, res: Response) {
  const { cnpj } = req.params as unknown as { cnpj: string };
  const dados = await clienteService.consultarInscricaoEstadual(cnpj);
  success(res, dados);
}
