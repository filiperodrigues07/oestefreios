import { Router } from 'express';
import { loginHandler, logoutHandler, meHandler, refreshHandler } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authLimiter } from '../middlewares/rateLimiter.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { loginSchema } from '../validators/auth.validator.js';

export const authRouter = Router();

authRouter.post('/login', authLimiter, validate(loginSchema), asyncHandler(loginHandler));
authRouter.post('/refresh', authLimiter, asyncHandler(refreshHandler));
authRouter.post('/logout', asyncHandler(logoutHandler));
authRouter.get('/me', authenticate, asyncHandler(meHandler));
