import type { Request } from 'express';

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

export function requestContext(req: Request): RequestContext {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}
