import { createHash } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../database/postgres/client.js';
import { passwordResetTokens } from '../../database/postgres/schema.js';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface CreatePasswordResetTokenInput {
  userId: string;
  token: string;
  expiresAt: Date;
}

export class PasswordResetTokenRepository {
  async create(input: CreatePasswordResetTokenInput) {
    const [row] = await db
      .insert(passwordResetTokens)
      .values({ userId: input.userId, tokenHash: hashToken(input.token), expiresAt: input.expiresAt })
      .returning();
    return row!;
  }

  /** Só considera válido: não usado ainda e dentro da validade. */
  async findValidByToken(token: string) {
    const tokenHash = hashToken(token);
    const [row] = await db
      .select()
      .from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.usedAt)));
    if (!row || row.expiresAt < new Date()) return null;
    return row;
  }

  async markUsed(id: string) {
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, id));
  }
}

export const passwordResetTokenRepository = new PasswordResetTokenRepository();
