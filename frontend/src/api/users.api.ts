import { apiFetch } from './httpClient.js';
import type { CreateUserInput, RoleOptionDTO, UpdateUserInput, UserSummaryDTO } from '../types/user.types.js';

export function listUsers(): Promise<UserSummaryDTO[]> {
  return apiFetch<UserSummaryDTO[]>('/usuarios');
}

export function listRoles(): Promise<RoleOptionDTO[]> {
  return apiFetch<RoleOptionDTO[]>('/usuarios/roles');
}

export function getUser(id: string): Promise<UserSummaryDTO> {
  return apiFetch<UserSummaryDTO>(`/usuarios/${id}`);
}

export function createUser(input: CreateUserInput): Promise<UserSummaryDTO> {
  return apiFetch<UserSummaryDTO>('/usuarios', { method: 'POST', body: input });
}

export function updateUser(id: string, input: UpdateUserInput): Promise<UserSummaryDTO> {
  return apiFetch<UserSummaryDTO>(`/usuarios/${id}`, { method: 'PUT', body: input });
}

export function deleteUser(id: string): Promise<null> {
  return apiFetch<null>(`/usuarios/${id}`, { method: 'DELETE' });
}

export function reenviarConvite(id: string): Promise<null> {
  return apiFetch<null>(`/usuarios/${id}/reenviar-convite`, { method: 'POST' });
}
