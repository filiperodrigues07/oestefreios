import { apiFetch } from './httpClient.js';
import type { AuthUser, LoginResponse } from '../types/auth.types.js';

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', { method: 'POST', body: { email, password } });
}

export function logout(): Promise<null> {
  return apiFetch<null>('/auth/logout', { method: 'POST' });
}

export function me(): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/me');
}

export type { AuthUser };
