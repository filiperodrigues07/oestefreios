import { apiFetch, apiFetchBlob, salvarBlobComoArquivo } from './httpClient.js';
import type { CherpUserOptionDTO, CreateUserInput, RoleOptionDTO, UpdateUserInput, UserSummaryDTO } from '../types/user.types.js';

export function listUsers(): Promise<UserSummaryDTO[]> {
  return apiFetch<UserSummaryDTO[]>('/usuarios');
}

export async function exportUsersExcel(filters: { busca: string; roleId: string; status: string; vinculo: string; sortBy: string; sortOrder: 'asc' | 'desc' }): Promise<void> {
  const params = new URLSearchParams(filters);
  const blob = await apiFetchBlob(`/usuarios/exportar-excel?${params}`);
  salvarBlobComoArquivo(blob, 'usuarios.xlsx');
}

export function listRoles(): Promise<RoleOptionDTO[]> {
  return apiFetch<RoleOptionDTO[]>('/usuarios/roles');
}

export function listCherpUsers(): Promise<CherpUserOptionDTO[]> {
  return apiFetch<CherpUserOptionDTO[]>('/usuarios/cherp');
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
