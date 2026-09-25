import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import * as authService from '../services/auth.service.js';
import { success } from '../utils/apiResponse.js';
import { UnauthorizedError } from '../errors/UnauthorizedError.js';
import { requestContext } from '../utils/requestContext.js';

const REFRESH_COOKIE = 'refreshToken';

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/auth',
};

export async function loginHandler(req: Request, res: Response) {
  const { email, password } = req.body as { email: string; password: string };
  const { response, refreshToken } = await authService.login(email, password, requestContext(req));
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
  success(res, response, 'Login realizado com sucesso.');
}

export async function refreshHandler(req: Request, res: Response) {
  const currentToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!currentToken) {
    throw new UnauthorizedError('Sessão não encontrada.', 'REFRESH_TOKEN_MISSING');
  }
  const { response, refreshToken } = await authService.refresh(currentToken, requestContext(req));
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
  success(res, response);
}

export async function logoutHandler(req: Request, res: Response) {
  const currentToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  await authService.logout(currentToken, requestContext(req));
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  success(res, null, 'Logout realizado com sucesso.');
}

export async function meHandler(req: Request, res: Response) {
  const response = await authService.getMe(req.user!.id);
  success(res, response);
}

export async function updateMyProfileHandler(req: Request, res: Response) {
  const { name, email } = req.body as { name: string; email: string };
  const response = await authService.updateMyProfile(req.user!.id, { name, email }, requestContext(req));
  success(res, response, 'Perfil atualizado com sucesso.');
}

const MAX_PROFILE_PHOTO_BYTES = 1024 * 1024;
const IMAGE_TYPES = new Map([
  ['image/png', { extension: 'png', signature: [0x89, 0x50, 0x4e, 0x47] }],
  ['image/jpeg', { extension: 'jpg', signature: [0xff, 0xd8, 0xff] }],
  ['image/webp', { extension: 'webp', signature: [0x52, 0x49, 0x46, 0x46] }],
]);

export async function updateMyProfilePhotoHandler(req: Request, res: Response) {
  const image = (req.body as { image?: unknown }).image;
  if (typeof image !== 'string') throw new Error('Envie uma imagem vÃ¡lida.');
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!match) throw new Error('Formato de imagem nÃ£o permitido.');
  const mime = match[1]!;
  const content = Buffer.from(match[2]!, 'base64');
  const type = IMAGE_TYPES.get(mime)!;
  if (content.length === 0 || content.length > MAX_PROFILE_PHOTO_BYTES || !type.signature.every((byte, index) => content[index] === byte)) {
    throw new Error('A imagem deve ter no mÃ¡ximo 1 MB e estar em formato PNG, JPEG ou WebP.');
  }
  const directory = resolve(process.cwd(), 'uploads', 'avatars');
  await mkdir(directory, { recursive: true });
  const filename = `${req.user!.id}.${type.extension}`;
  const finalPath = resolve(directory, filename);
  const tempPath = `${finalPath}.${randomUUID()}.tmp`;
  await writeFile(tempPath, content, { flag: 'wx' });
  await rename(tempPath, finalPath);
  const response = await authService.updateMyProfilePhoto(req.user!.id, `/api/uploads/avatars/${filename}?v=${Date.now()}`, requestContext(req));
  success(res, response, 'Foto de perfil atualizada com sucesso.');
}

const MENSAGEM_GENERICA_RESET = 'Se esse e-mail estiver cadastrado, você receberá um link de redefinição.';

export async function forgotPasswordHandler(req: Request, res: Response) {
  const { email } = req.body as { email: string };
  await authService.forgotPassword(email, requestContext(req));
  success(res, null, MENSAGEM_GENERICA_RESET);
}

export async function resetPasswordHandler(req: Request, res: Response) {
  const { token, password } = req.body as { token: string; password: string };
  await authService.resetPassword(token, password, requestContext(req));
  success(res, null, 'Senha redefinida com sucesso. Faça login com a nova senha.');
}

export async function authConfigHandler(_req: Request, res: Response) {
  const passwordResetEnabled = await authService.isPasswordResetAvailable();
  success(res, { passwordResetEnabled });
}

export async function changePasswordHandler(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  await authService.changePassword(req.user!.id, currentPassword, newPassword, requestContext(req));
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  success(res, null, 'Senha alterada. Entre novamente.');
}
