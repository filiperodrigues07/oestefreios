import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Encaminha rejeições de handlers async para o errorHandler central. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
