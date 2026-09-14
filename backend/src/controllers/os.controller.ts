import type { Request, Response } from 'express';
import * as osService from '../services/os.service.js';
import { success } from '../utils/apiResponse.js';

export async function listOSHandler(req: Request, res: Response) {
  const filter = req.query as unknown as { status?: string; clienteCodigo?: string; page?: number; limit?: number };
  const result = await osService.listOS(filter, req.user!.permissions);
  success(res, result);
}

export async function getOSByIdHandler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const os = await osService.getOSById(id, req.user!.permissions);
  success(res, os);
}
