import type { Permission } from '../types/auth.types.js';

/** Corpo de resposta do login/refresh/me. O refresh token NUNCA vai aqui — só no cookie httpOnly. */
export interface LoginResponseDTO {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    roleId: string;
    roleName: string;
    permissions: Permission[];
  };
}
