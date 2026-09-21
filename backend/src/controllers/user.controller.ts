import type { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import * as userService from '../services/user.service.js';
import { success } from '../utils/apiResponse.js';
import { requestContext } from '../utils/requestContext.js';

export async function listUsersHandler(_req: Request, res: Response) {
  const users = await userService.listUsers();
  success(res, users);
}

export async function exportUsersExcelHandler(req: Request, res: Response) {
  const param = (key: string) => typeof req.query[key] === 'string' ? req.query[key] as string : '';
  const safeText = (value: string) => /^[=+\-@]/.test(value) ? `'${value}` : value;
  const search = param('busca').trim().toLocaleLowerCase('pt-BR');
  const roleId = param('roleId');
  const status = param('status');
  const vinculo = param('vinculo');
  const users = (await userService.listUsers()).filter((user) => {
    if (search && ![user.name, user.email, user.roleName, String(user.cherpUsuarioChave ?? '')].some((value) => value.toLocaleLowerCase('pt-BR').includes(search))) return false;
    if (roleId && user.roleId !== roleId) return false;
    if (status === 'ativo' && !user.isActive) return false;
    if (status === 'inativo' && user.isActive) return false;
    if (vinculo === 'vinculado' && !user.cherpUsuarioChave) return false;
    if (vinculo === 'nao-vinculado' && user.cherpUsuarioChave) return false;
    return true;
  });
  const sortBy = param('sortBy') || 'name';
  const direction = param('sortOrder') === 'desc' ? -1 : 1;
  users.sort((a, b) => {
    const value = (user: typeof a) => {
      if (sortBy === 'isActive') return user.isActive ? 'Ativo' : 'Inativo';
      if (sortBy === 'cherpUsuarioChave') return user.cherpUsuarioChave ?? -1;
      if (sortBy === 'email' || sortBy === 'roleName') return user[sortBy];
      return user.name;
    };
    return direction * String(value(a)).localeCompare(String(value(b)), 'pt-BR', { numeric: true, sensitivity: 'base' });
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Usuários');
  sheet.columns = [
    { header: 'Nome', key: 'name', width: 30 },
    { header: 'E-mail', key: 'email', width: 38 },
    { header: 'Perfil', key: 'role', width: 22 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'CHERP', key: 'cherp', width: 18 },
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF163A73' } };
  sheet.autoFilter = { from: 'A1', to: 'E1' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  users.forEach((user) => sheet.addRow({ name: safeText(user.name), email: safeText(user.email), role: safeText(user.roleName), status: user.isActive ? 'Ativo' : 'Inativo', cherp: user.cherpUsuarioChave ?? 'Não vinculado' }));

  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="usuarios.xlsx"');
  res.send(Buffer.from(buffer));
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
