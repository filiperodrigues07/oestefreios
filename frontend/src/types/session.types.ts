export interface ActiveSessionDTO {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  ip: string | null;
  os: string;
  browser: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string | null;
}

export type StatusPresenca = 'online' | 'ocioso' | 'offline';

export interface UsuarioLicencaDTO {
  id: string;
  name: string;
  email: string;
  roleName: string;
  photoUrl: string | null;
  status: StatusPresenca;
  lastSeenAt: string | null;
  sessao: { id: string; ip: string | null; os: string; browser: string; loginAt: string } | null;
}

export interface LicenseSummaryDTO {
  limite: number;
  emUso: number;
  idleMinutes: number;
  usuarios: UsuarioLicencaDTO[];
}
