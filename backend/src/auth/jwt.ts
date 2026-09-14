import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { JwtPayload } from '../types/auth.types.js';

export function signAccessToken(payload: JwtPayload): string {
  const options: jwt.SignOptions = { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

interface RefreshTokenPayload {
  sub: string;
  tokenId: string;
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  const options: jwt.SignOptions = { expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}
