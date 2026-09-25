import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const ADMIN = {
  email: process.env.E2E_EMAIL ?? 'admin@dev.local',
  senha: process.env.E2E_SENHA ?? 'Admin@123456',
};

/** Segundo usuário (Supervisor) pro teste de edição simultânea — sessão única por usuário não deixa reusar o admin. */
export const SUPERVISOR = {
  email: 'e2e.supervisor@dev.local',
  senhaInicial: 'E2e@Inicial123',
  senha: 'Freio#Traseiro2026',
};

/**
 * Garante o Supervisor de teste pela API (idempotente entre execuções). Roda antes de qualquer
 * login pela tela: o login de API do admin derruba sessões anteriores dele.
 */
export async function garantirSupervisor(api: APIRequestContext): Promise<void> {
  const loginApi = async (email: string, senha: string) => {
    const res = await api.post('/api/auth/login', { data: { email, password: senha } });
    return res.ok() ? ((await res.json()) as { data: { accessToken: string } }).data.accessToken : null;
  };
  if (await loginApi(SUPERVISOR.email, SUPERVISOR.senha)) return;

  const tokenAdmin = await loginApi(ADMIN.email, ADMIN.senha);
  if (!tokenAdmin) throw new Error('Login de API do admin falhou');
  const auth = { Authorization: `Bearer ${tokenAdmin}` };
  const roles = ((await (await api.get('/api/usuarios/roles', { headers: auth })).json()) as {
    data: { id: string; name: string }[];
  }).data;
  const supervisor = roles.find((r) => r.name === 'Supervisor');
  if (!supervisor) throw new Error('Perfil Supervisor não existe no seed');
  await api.post('/api/usuarios', {
    headers: { ...auth, 'Idempotency-Key': crypto.randomUUID() },
    data: { name: 'E2E Supervisor', email: SUPERVISOR.email, roleId: supervisor.id, password: SUPERVISOR.senhaInicial },
  });

  // Usuário criado com senha inicial precisa trocar a senha antes de usar o sistema.
  const tokenSupervisor = await loginApi(SUPERVISOR.email, SUPERVISOR.senhaInicial);
  if (!tokenSupervisor) throw new Error('Login inicial do supervisor de teste falhou');
  const troca = await api.post('/api/auth/change-password', {
    headers: { Authorization: `Bearer ${tokenSupervisor}` },
    data: { currentPassword: SUPERVISOR.senhaInicial, newPassword: SUPERVISOR.senha },
  });
  if (!troca.ok()) throw new Error(`Troca de senha do supervisor falhou: ${troca.status()} ${await troca.text()}`);
}

export async function login(page: Page, usuario: { email: string; senha: string } = ADMIN) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(usuario.email);
  await page.getByLabel('Senha', { exact: true }).fill(usuario.senha);
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Cria uma OS pelo caminho real da tela (a placa "ABC-1234" do mock já traz o cliente) e devolve o id. */
export async function criarOS(page: Page, problema = 'BARULHO NO FREIO'): Promise<string> {
  await page.goto('/os/nova');
  await page.getByPlaceholder('Digite a placa do veículo').fill('ABC');
  await page.getByRole('listbox').getByRole('option').first().click();
  await page.locator('#problema').fill(problema);
  await page.getByRole('button', { name: 'Criar OS' }).click();
  await expect(page).toHaveURL(/\/os\/[0-9a-f-]{36}$/);
  return page.url().split('/os/')[1]!;
}

export async function abrirAba(page: Page, nome: RegExp) {
  await page.getByRole('tab', { name: nome }).click();
}

/** Página com alteração pendente mostra o aviso nativo ao recarregar: no teste, aceita e segue. */
export function aceitarAvisosDeSaida(page: Page) {
  page.on('dialog', (dialog) => void dialog.accept());
}
