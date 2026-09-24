import { eq, sql } from 'drizzle-orm';
import { db, pool } from '../database/postgres/client.js';
import { users } from '../database/postgres/schema.js';

/**
 * Concede/revoga o proprietário (super admin) — único caminho: não existe endpoint nem tela para isso.
 *   npm run superadmin -- --email dono@exemplo.com          (conceder)
 *   npm run superadmin -- --email dono@exemplo.com --revoke (revogar; recusa o último)
 *   npm run superadmin -- --list                            (listar)
 * Na VPS: cd backend && node dist/scripts/superAdmin.js --email ...
 */
async function main() {
  const args = process.argv.slice(2);
  const valorDe = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };

  if (args.includes('--list')) {
    const lista = await db.select({ name: users.name, email: users.email, ativo: users.isActive }).from(users).where(eq(users.isSuperAdmin, true));
    console.log(lista.length ? lista.map((u) => `- ${u.name} <${u.email}>${u.ativo ? '' : ' (inativo)'}`).join('\n') : 'Nenhum proprietário cadastrado.');
    return;
  }

  const email = valorDe('--email')?.trim();
  if (!email) throw new Error('Informe --email <e-mail> (ou --list).');
  const [alvo] = await db.select({ id: users.id, name: users.name, isSuperAdmin: users.isSuperAdmin }).from(users).where(sql`lower(${users.email}) = lower(${email})`);
  if (!alvo) throw new Error(`Usuário "${email}" não encontrado.`);

  if (args.includes('--revoke')) {
    if (!alvo.isSuperAdmin) {
      console.log(`${alvo.name} já não é proprietário.`);
      return;
    }
    const outros = await db.select({ id: users.id }).from(users).where(sql`${users.isSuperAdmin} = true AND ${users.isActive} = true AND ${users.id} <> ${alvo.id}`);
    if (outros.length === 0) throw new Error('Recusado: é o último proprietário ativo. Conceda a outra conta antes de revogar esta.');
    await db.update(users).set({ isSuperAdmin: false, sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, alvo.id));
    console.log(`Proprietário revogado: ${alvo.name}. Sessões abertas dele foram encerradas.`);
    return;
  }

  await db.update(users).set({ isSuperAdmin: true }).where(eq(users.id, alvo.id));
  console.log(`Proprietário concedido: ${alvo.name} <${email}>.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
