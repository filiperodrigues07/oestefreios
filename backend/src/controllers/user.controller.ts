import type { Request, Response } from 'express';
import * as userService from '../services/user.service.js';
import { success } from '../utils/apiResponse.js';

function requestContext(req: Request) {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

export async function listUsersHandler(_req: Request, res: Response) {
  const users = await userService.listUsers();
  success(res, users);
}

export async function listRolesHandler(_req: Request, res: Response) {
  const roles = await userService.listRoles();
  success(res, roles);
}

export async function listCherpUsersHandler(_req: Request, res: Response) {
  success(res, await userService.listCherpUsers());
}

export async function getUserHandler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const user = await userService.getUserById(id);
  success(res, user);
}

export async function createUserHandler(req: Request, res: Response) {
  const user = await userService.createUser(req.body, req.user!, requestContext(req));
  success(res, user, 'Usuário criado com sucesso.', 201);
}

export async function updateUserHandler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const user = await userService.updateUser(id, req.body, req.user!, requestContext(req));
  success(res, user, 'Usuário atualizado com sucesso.');
}

export async function deleteUserHandler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  await userService.deleteUser(id, req.user!, requestContext(req));
  success(res, null, 'Usuário excluído com sucesso.');
}

export async function reenviarConviteHandler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  await userService.reenviarConvite(id, req.user!, requestContext(req));
  success(res, null, 'Convite reenviado com sucesso.');
}
