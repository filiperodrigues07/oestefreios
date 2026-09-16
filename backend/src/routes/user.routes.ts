import { Router } from 'express';
import {
  createUserHandler,
  deleteUserHandler,
  getUserHandler,
  listRolesHandler,
  listUsersHandler,
  reenviarConviteHandler,
  updateUserHandler,
} from '../controllers/user.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createUserSchema, updateUserSchema, userIdParamSchema } from '../validators/user.validator.js';

export const userRouter = Router();

userRouter.use(authenticate);

userRouter.get('/', requirePermission('USER_VIEW'), asyncHandler(listUsersHandler));
userRouter.get('/roles', requirePermission('USER_VIEW'), asyncHandler(listRolesHandler));
userRouter.get('/:id', requirePermission('USER_VIEW'), validate(userIdParamSchema, 'params'), asyncHandler(getUserHandler));

userRouter.post('/', requirePermission('USER_CREATE'), validate(createUserSchema), asyncHandler(createUserHandler));

userRouter.put(
  '/:id',
  requirePermission('USER_EDIT'),
  validate(userIdParamSchema, 'params'),
  validate(updateUserSchema),
  asyncHandler(updateUserHandler),
);

userRouter.post(
  '/:id/reenviar-convite',
  requirePermission('USER_EDIT'),
  validate(userIdParamSchema, 'params'),
  asyncHandler(reenviarConviteHandler),
);

userRouter.delete(
  '/:id',
  requirePermission('USER_DELETE'),
  validate(userIdParamSchema, 'params'),
  asyncHandler(deleteUserHandler),
);
