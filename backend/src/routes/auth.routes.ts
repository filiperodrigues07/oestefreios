import { Router } from 'express';
import {
  authConfigHandler,
  forgotPasswordHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  resetPasswordHandler,
  updateMyProfileHandler,
  updateMyProfilePhotoHandler,
  changePasswordHandler,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authLimiter, esqueciSenhaEmailLimiter, esqueciSenhaIpLimiter, refreshLimiter } from '../middlewares/rateLimiter.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { changePasswordSchema, forgotPasswordSchema, loginSchema, resetPasswordSchema, updateMyProfileSchema } from '../validators/auth.validator.js';

export const authRouter = Router();

authRouter.get('/config', asyncHandler(authConfigHandler));
authRouter.post('/login', authLimiter, validate(loginSchema), asyncHandler(loginHandler));
authRouter.post('/refresh', refreshLimiter, asyncHandler(refreshHandler));
authRouter.post('/logout', asyncHandler(logoutHandler));
authRouter.get('/me', authenticate, asyncHandler(meHandler));
authRouter.put('/me', authenticate, validate(updateMyProfileSchema), asyncHandler(updateMyProfileHandler));
authRouter.put('/me/photo', authenticate, asyncHandler(updateMyProfilePhotoHandler));
authRouter.post('/change-password', authenticate, validate(changePasswordSchema), asyncHandler(changePasswordHandler));
authRouter.post('/forgot-password', esqueciSenhaIpLimiter, validate(forgotPasswordSchema), esqueciSenhaEmailLimiter, asyncHandler(forgotPasswordHandler));
authRouter.post('/reset-password', authLimiter, validate(resetPasswordSchema), asyncHandler(resetPasswordHandler));
