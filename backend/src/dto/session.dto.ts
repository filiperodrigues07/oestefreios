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
  /** Última atividade autenticada do usuário (base da licença simultânea); null = fora da licença. */
  lastSeenAt: string | null;
}
