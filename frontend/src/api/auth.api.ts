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

export function getAuthConfig(): Promise<{ passwordResetEnabled: boolean }> {
  return apiFetch<{ passwordResetEnabled: boolean }>('/auth/config');
}

export function forgotPassword(email: string): Promise<null> {
  return apiFetch<null>('/auth/forgot-password', { method: 'POST', body: { email } });
}

export function resetPassword(token: string, password: string): Promise<null> {
  return apiFetch<null>('/auth/reset-password', { method: 'POST', body: { token, password } });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<null> {
  return apiFetch<null>('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
}

export function updateMyProfile(name: string, email: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/me', { method: 'PUT', body: { name, email } });
}

export function updateMyProfilePhoto(image: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/me/photo', { method: 'PUT', body: { image } });
}

export type { AuthUser };
