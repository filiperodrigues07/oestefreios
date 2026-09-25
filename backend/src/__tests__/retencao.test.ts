import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db, pool } from '../database/postgres/client.js';
import { auditLogs, refreshTokens, roles, users } from '../database/postgres/schema.js';
import { executarRetencao } from '../services/retencao.service.js';

const DIA_MS = 24 * 60 * 60 * 1000;
const userId = randomUUID();
const eventoTeste = `RETENCAO_TESTE_${userId}`;

describe('executarRetencao', () => {
  beforeAll(async () => {
    const [role] = await db.select({ id: roles.id }).from(roles).limit(1);
    await db.insert(users).values({ id: userId, roleId: role!.id, name: 'Retenção', email: `ret-${userId}@teste.local`, passwordHash: 'x' });
  });

  afterAll(async () => {
    await db.delete(auditLogs).where(eq(auditLogs.event, eventoTeste));
    await db.delete(users).where(eq(users.id, userId));
    await pool.end();
  });

  it('apaga token expirado/revogado antigo e auditoria velha; preserva o recente', async () => {
    const agora = new Date();
    const dias = (n: number) => new Date(agora.getTime() - n * DIA_MS);
    const ids = { expiradoAntigo: randomUUID(), revogadoAntigo: randomUUID(), revogadoRecente: randomUUID(), ativo: randomUUID() };
    const base = { userId, familyId: randomUUID(), tokenHash: 'h' };
    await db.insert(refreshTokens).values([
      { ...base, id: ids.expiradoAntigo, expiresAt: dias(60) },
      { ...base, id: ids.revogadoAntigo, expiresAt: dias(-5), revokedAt: dias(45) },
      { ...base, id: ids.revogadoRecente, expiresAt: dias(-5), revokedAt: dias(2) },
      { ...base, id: ids.ativo, expiresAt: dias(-5) },
    ]);
    await db.insert(auditLogs).values([
      { event: eventoTeste, createdAt: dias(800) },
      { event: eventoTeste, createdAt: dias(10) },
    ]);

    const r = await executarRetencao({ agora });
    expect(r.refreshTokens).toBeGreaterThanOrEqual(2);
    expect(r.auditLogs).toBeGreaterThanOrEqual(1);

    const restantes = await db.select({ id: refreshTokens.id }).from(refreshTokens).where(inArray(refreshTokens.id, Object.values(ids)));
    expect(restantes.map((t) => t.id).sort()).toEqual([ids.revogadoRecente, ids.ativo].sort());
    const audit = await db.select({ id: auditLogs.id }).from(auditLogs).where(eq(auditLogs.event, eventoTeste));
    expect(audit).toHaveLength(1);
  });
});
