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

export interface LicenseSummaryDTO {
  limite: number;
  emUso: number;
  idleMinutes: number;
  usuarios: { id: string; name: string; email: string; lastSeenAt: string }[];
}
