import { eq } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { hashPassword } from '../../auth/password.js';
import { PERMISSIONS, type Permission } from '../../types/auth.types.js';
import { db, pool } from './client.js';
import { permissions, rolePermissions, roles, userPermissions, users } from './schema.js';

const ALL: Permission[] = [...PERMISSIONS];

const ROLE_DEFINITIONS: { name: string; description: string; permissions: Permission[] }[] = [
  { name: 'Administrador', description: 'Acesso completo ao sistema.', permissions: ALL },
  {
    name: 'Mecânico',
    description: 'Executa e atualiza OS. Nunca vê dados financeiros.',
    permissions: [
      'OS_VIEW',
      'OS_CHANGE_STATUS',
      'PRODUCT_VIEW',
      'PRODUCT_SEARCH',
      'PRODUCT_ADD_TO_OS',
      'SERVICE_VIEW',
      'SERVICE_SEARCH',
      'SERVICE_ADD_TO_OS',
    ],
  },
  {
    name: 'Supervisor',
    description: 'Acompanha a operação e vê valores.',
    permissions: [
      'OS_VIEW',
      'OS_EDIT',
      'OS_CHANGE_STATUS',
      'PRODUCT_VIEW',
      'PRODUCT_SEARCH',
      'PRODUCT_ADD_TO_OS',
      'SERVICE_VIEW',
      'SERVICE_SEARCH',
      'SERVICE_ADD_TO_OS',
      'FINANCIAL_VIEW',
      'REPORT_VIEW',
    ],
  },
  {
    name: 'Atendente',
    description: 'Abre e edita OS, sem acesso financeiro.',
    permissions: [
      'OS_VIEW',
      'OS_CREATE',
      'OS_EDIT',
      'PRODUCT_VIEW',
      'PRODUCT_SEARCH',
      'PRODUCT_ADD_TO_OS',
      'SERVICE_VIEW',
      'SERVICE_SEARCH',
      'SERVICE_ADD_TO_OS',
    ],
  },
  {
    name: 'Gerente',
    description: 'Gestão operacional e financeira, sem configurações de sistema.',
    permissions: ALL.filter((p) => p !== 'SYSTEM_SETTINGS'),
  },
];

async function main() {
  console.log('Seed: criando permissões...');
  const permissionRows = new Map<Permission, string>();
  for (const code of PERMISSIONS) {
    const [row] = await db
      .insert(permissions)
      .values({ code })
      .onConflictDoUpdate({ target: permissions.code, set: { code } })
      .returning();
    permissionRows.set(code, row!.id);
  }

  console.log('Seed: criando perfis (roles)...');
  for (const roleDef of ROLE_DEFINITIONS) {
    const [role] = await db
      .insert(roles)
      .values({ name: roleDef.name, description: roleDef.description, isSystem: true })
      .onConflictDoUpdate({ target: roles.name, set: { description: roleDef.description } })
      .returning();

    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role!.id));
    for (const code of roleDef.permissions) {
      await db.insert(rolePermissions).values({ roleId: role!.id, permissionId: permissionRows.get(code)! });
    }
  }

  // Permissão efetiva vive por usuário (tabela user_permissions), não só por role — o role aqui
  // só serve de preset pra saber quais permissões dar ao criar a conta (ver UsuariosPage.tsx,
  // mesma lógica). Sem isso, um usuário criado pelo seed loga mas não enxerga nada no app.
  async function syncUserPermissions(userId: string, permissionCodes: Permission[]) {
    await db.delete(userPermissions).where(eq(userPermissions.userId, userId));
    for (const code of permissionCodes) {
      await db.insert(userPermissions).values({ userId, permissionId: permissionRows.get(code)! });
    }
  }

  console.log('Seed: criando usuário admin de desenvolvimento...');
  const [adminRole] = await db.select().from(roles).where(eq(roles.name, 'Administrador'));
  const adminRoleDef = ROLE_DEFINITIONS.find((r) => r.name === 'Administrador')!;
  const passwordHash = await hashPassword(env.DEV_ADMIN_PASSWORD);

  const [adminUser] = await db
    .insert(users)
    .values({
      name: env.NODE_ENV === 'production' ? 'Administrador' : 'Admin (dev)',
      email: env.DEV_ADMIN_EMAIL,
      passwordHash,
      roleId: adminRole!.id,
      isSuperAdmin: true,
    })
    .onConflictDoUpdate({ target: users.email, set: { passwordHash, roleId: adminRole!.id, isSuperAdmin: true } })
    .returning({ id: users.id });
  await syncUserPermissions(adminUser!.id, adminRoleDef.permissions);

  console.log(`Admin: ${env.DEV_ADMIN_EMAIL} (senha definida em DEV_ADMIN_PASSWORD)`);

  // Conta de teste com senha fixa e pública neste repositório — nunca criar em produção,
  // senão qualquer pessoa com acesso ao código consegue logar como "Mecânico" no ambiente real.
  if (env.NODE_ENV !== 'production') {
    const [mecanicoRole] = await db.select().from(roles).where(eq(roles.name, 'Mecânico'));
    const mecanicoRoleDef = ROLE_DEFINITIONS.find((r) => r.name === 'Mecânico')!;
    const mecanicoPasswordHash = await hashPassword('Mecanico@123456');
    const [mecanicoUser] = await db
      .insert(users)
      .values({
        name: 'Mecânico (dev)',
        email: 'mecanico@dev.local',
        passwordHash: mecanicoPasswordHash,
        roleId: mecanicoRole!.id,
      })
      .onConflictDoUpdate({ target: users.email, set: { passwordHash: mecanicoPasswordHash, roleId: mecanicoRole!.id } })
      .returning({ id: users.id });
    await syncUserPermissions(mecanicoUser!.id, mecanicoRoleDef.permissions);

    console.log('Usuário de dev "Mecânico": mecanico@dev.local / Mecanico@123456 (NUNCA usar em produção)');
  }

  console.log('Seed concluído.');
  await pool.end();
}

main().catch((err) => {
  console.error('Falha ao rodar seed:', err);
  process.exit(1);
});
