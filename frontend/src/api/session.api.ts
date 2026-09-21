import { apiFetch } from './httpClient.js';
import type { ActiveSessionDTO } from '../types/session.types.js';

export function listActiveSessions(): Promise<ActiveSessionDTO[]> {
  return apiFetch('/sessions');
}

export function forceLogoutSession(id: string): Promise<void> {
  return apiFetch(`/sessions/${id}`, { method: 'DELETE' });
}

export function forceLogoutAllForUser(userId: string): Promise<void> {
  return apiFetch(`/users/${userId}/sessions`, { method: 'DELETE' });
}
