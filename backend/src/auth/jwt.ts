import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { JwtPayload } from '../types/auth.types.js';

export function signAccessToken(payload: JwtPayload): string {
  const options: jwt.SignOptions = { algorithm: 'HS256', issuer: 'oeste-freios', audience: 'oeste-freios-web', expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'oeste-freios', audience: 'oeste-freios-web' }) as JwtPayload;
}

interface RefreshTokenPayload {
  sub: string;
  tokenId: string;
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  const options: jwt.SignOptions = { algorithm: 'HS256', issuer: 'oeste-freios', audience: 'oeste-freios-refresh', expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'], issuer: 'oeste-freios', audience: 'oeste-freios-refresh' }) as RefreshTokenPayload;
}
