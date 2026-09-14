import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import * as authService from '../services/auth.service.js';
import { success } from '../utils/apiResponse.js';
import { UnauthorizedError } from '../errors/UnauthorizedError.js';

const REFRESH_COOKIE = 'refreshToken';

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/auth',
};

function requestContext(req: Request) {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

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
