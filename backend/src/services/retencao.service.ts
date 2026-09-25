import { and, isNotNull, lt, or } from 'drizzle-orm';
import { db } from '../database/postgres/client.js';
import { auditLogs, passwordResetTokens, refreshTokens } from '../database/postgres/schema.js';
import { logger } from '../utils/logger.js';

const DIA_MS = 24 * 60 * 60 * 1000;

export interface RetencaoOpcoes {
  /** Tokens expirados/revogados são apagados depois deste prazo. */
  tokensDias?: number;
  /** Eventos de auditoria mais antigos que isto são apagados. */
  auditoriaDias?: number;
  agora?: Date;
}

/**
 * Limpa o que só cresce: refresh tokens e tokens de reset já inúteis, e auditoria antiga.
 * Um refresh token só é apagado quando expirado ou revogado há mais de `tokensDias` — a janela evita
 * perder o rastro usado na detecção de reuso (TOKEN_REUSE_DETECTED) logo após a rotação.
 */
export async function executarRetencao({ tokensDias = 30, auditoriaDias = 730, agora = new Date() }: RetencaoOpcoes = {}) {
  const limiteTokens = new Date(agora.getTime() - tokensDias * DIA_MS);
  const limiteAuditoria = new Date(agora.getTime() - auditoriaDias * DIA_MS);

  const refresh = await db
    .delete(refreshTokens)
    .where(or(lt(refreshTokens.expiresAt, limiteTokens), and(isNotNull(refreshTokens.revokedAt), lt(refreshTokens.revokedAt, limiteTokens))))
    .returning({ id: refreshTokens.id });

  const reset = await db
    .delete(passwordResetTokens)
    .where(or(lt(passwordResetTokens.expiresAt, limiteTokens), and(isNotNull(passwordResetTokens.usedAt), lt(passwordResetTokens.usedAt, limiteTokens))))
    .returning({ id: passwordResetTokens.id });

  const audit = await db.delete(auditLogs).where(lt(auditLogs.createdAt, limiteAuditoria)).returning({ id: auditLogs.id });

  return { refreshTokens: refresh.length, passwordResetTokens: reset.length, auditLogs: audit.length };
}

/** Roda 1 min após subir e depois a cada 24 h. O timer não segura o processo no shutdown. */
export function agendarRetencao(): () => void {
  const rodar = () => {
    executarRetencao()
      .then((r) => logger.info(r, 'Retenção de dados executada'))
      .catch((err) => logger.error({ err }, 'Falha na retenção de dados'));
  };
  const inicial = setTimeout(rodar, 60_000);
  const periodico = setInterval(rodar, DIA_MS);
  inicial.unref();
  periodico.unref();
  return () => {
    clearTimeout(inicial);
    clearInterval(periodico);
  };
}

