import { create } from 'zustand';
import type { AuthUser, Permission } from '../types/auth.types.js';

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  status: 'idle' | 'authenticated' | 'unauthenticated';
  setSession: (accessToken: string, user: AuthUser) => void;
  clearSession: () => void;
}

/**
 * Access token e usuário SÓ em memória — nunca localStorage/sessionStorage.
 * O refresh token vive em cookie httpOnly, fora do alcance do JS.
 */
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  status: 'idle',
  setSession: (accessToken, user) => set({ accessToken, user, status: 'authenticated' }),
  clearSession: () => set({ accessToken: null, user: null, status: 'unauthenticated' }),
}));

export function hasPermission(permission: Permission): boolean {
  return useAuthStore.getState().user?.permissions.includes(permission) ?? false;
}
