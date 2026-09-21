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
}
