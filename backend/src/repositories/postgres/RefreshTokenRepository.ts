import { createHash, randomUUID } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../../database/postgres/client.js';
import { refreshTokens } from '../../database/postgres/schema.js';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface CreateRefreshTokenInput {
  userId: string;
  token: string;
  familyId?: string;
  expiresAt: Date;
  createdByIp?: string;
  userAgent?: string;
}

export class RefreshTokenRepository {
  async create(input: CreateRefreshTokenInput) {
    const familyId = input.familyId ?? randomUUID();
    const [row] = await db
      .insert(refreshTokens)
      .values({
        userId: input.userId,
        tokenHash: hashToken(input.token),
        familyId,
        expiresAt: input.expiresAt,
        createdByIp: input.createdByIp,
        userAgent: input.userAgent,
      })
      .returning();
    return row!;
  }

  async findValidByToken(token: string) {
    const tokenHash = hashToken(token);
    const [row] = await db
      .select()
      .from(refreshTokens)
      .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
    return row ?? null;
  }

  async findByToken(token: string) {
    const tokenHash = hashToken(token);
    const [row] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
    return row ?? null;
  }

  async revoke(id: string, replacedByTokenId?: string) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date(), replacedByTokenId })
      .where(eq(refreshTokens.id, id));
  }

  /** Revoga toda a família — usado quando um token já rotacionado é reapresentado (indício de roubo). */
  async revokeFamily(familyId: string) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
  }

  /** Derruba todas as sessões ativas do usuário — usado após redefinição de senha por e-mail. */
  async revokeAllForUser(userId: string) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  }

  /** Quantas sessões (famílias de refresh) válidas o usuário tem — o login usa pra saber se vai derrubar uma. */
  async countActiveForUser(userId: string): Promise<number> {
    const rows = await db
      .selectDistinct({ familyId: refreshTokens.familyId })
      .from(refreshTokens)
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date())));
    return rows.length;
  }
}

export const refreshTokenRepository = new RefreshTokenRepository();
