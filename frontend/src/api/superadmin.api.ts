import { apiFetch } from './httpClient.js';
import type { LicencaConfigDTO } from '../types/session.types.js';

export function getLicencaConfig(): Promise<LicencaConfigDTO> {
  return apiFetch('/superadmin/licenca');
}

export function saveLicencaConfig(input: Pick<LicencaConfigDTO, 'limite' | 'idleMinutes' | 'sessaoUnica'>): Promise<LicencaConfigDTO> {
  return apiFetch('/superadmin/licenca', { method: 'PUT', body: input, queueOffline: false });
}
