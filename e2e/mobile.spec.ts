import { expect, test, type Page } from '@playwright/test';

const OS_ID = '11111111-1111-4111-8111-111111111111';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64');

function mockApi(page: Page, falharCriacao = false) {
  const calls = { key: '', miniaturas: 0, completas: 0, envios: 0 };
  void page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (!path.startsWith('/api/')) return route.continue();

    if (path.startsWith(`/api/os/${OS_ID}/imagens/foto-`)) {
      if (url.searchParams.get('preview') === '1') calls.miniaturas++;
      else calls.completas++;
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    }
    if (path === '/api/os' && request.method() === 'POST') {
      calls.key = request.headers()['idempotency-key'] ?? '';
      if (falharCriacao) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'SELECT senha FROM usuarios' } }) });
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: OS_ID, numero: 123 } }) });
    }

    let data: unknown = {};
    if (path === '/api/auth/refresh') data = {
      accessToken: 'token-teste',
      user: { id: 'mobile', name: 'Teste Mobile', email: 'mobile@teste.local', photoUrl: null, roleId: 'gerente', roleName: 'Gerente', permissions: ['OS_VIEW', 'OS_CREATE', 'OS_EDIT', 'CLIENT_VIEW', 'REPORT_VIEW', 'FINANCIAL_VIEW'], mustChangePassword: false, isSuperAdmin: false },
    };
    else if (path === '/api/dashboard/operacional') data = { atencao: [] };
    else if (path === '/api/equipamentos') data = { items: [{ codigo: 'V1', clienteCodigo: 'C1', descricao: 'CHEVROLET ONIX JOY', identificacao: 'JAL-C624' }], total: 1 };
    else if (path === '/api/clientes/C1') data = { codigo: 'C1', nome: 'GESTAO CONSULTORIA' };
    else if (path === `/api/os/${OS_ID}/imagens`) {
      if (request.method() === 'POST') calls.envios++;
      data = Array.from({ length: 20 }, (_, index) => ({ identificador: `foto-${index}`, descricao: `Foto ${index}`, nomeArquivo: `foto-${index}.png`, data: '2026-09-26' }));
    }
    else if (path === `/api/os/${OS_ID}`) data = { id: OS_ID, numero: 123, clienteCodigo: 'C1', equipamentoCodigo: 'V1', status: 'ABERTA', prioridade: 'ALTA', produtos: [], servicos: [], historico: [] };
    else if (path === '/api/os') data = { items: [], total: 0 };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  });
  return calls;
}

async function selecionarVeiculo(page: Page) {
  await page.getByPlaceholder('Digite a placa do veículo').fill('JAL');
  await page.getByRole('listbox').getByRole('option').first().click();
  await expect(page.getByText('GESTAO CONSULTORIA')).toBeVisible();
}

test('cria OS com toque mesmo sem randomUUID', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined, configurable: true }));
  const calls = mockApi(page);
  await page.goto('/os/nova');
  await selecionarVeiculo(page);

  expect((await page.getByRole('button', { name: 'Trocar' }).first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole('tab', { name: 'Dados' }).locator('svg:visible')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);

  await page.locator('#problema').fill('BARULHO');
  await page.getByRole('button', { name: 'Criar OS' }).click();
  await expect(page).toHaveURL(new RegExp(`/os/${OS_ID}$`));
  expect(calls.key).toMatch(/^[0-9a-f-]{36}$/);
});

test('mostra erro amigável ao falhar criação', async ({ page }) => {
  mockApi(page, true);
  await page.goto('/os/nova');
  await selecionarVeiculo(page);
  await page.getByRole('button', { name: 'Criar OS' }).click();
  const aviso = page.getByRole('alert').last();
  await expect(aviso).toContainText('Tente novamente');
  await expect(aviso).not.toContainText('SELECT');
});

test('carrega miniaturas sob demanda e foto completa ao abrir', async ({ page }) => {
  const calls = mockApi(page);
  await page.goto(`/os/${OS_ID}?tab=fotos`);
  await expect(page.getByRole('button', { name: 'Abrir foto Foto 0' })).toBeVisible();
  expect(calls.miniaturas).toBeGreaterThan(0);
  expect(calls.miniaturas).toBeLessThan(20);
  expect(calls.completas).toBe(0);
  await page.getByRole('button', { name: 'Abrir foto Foto 0' }).click();
  await expect(page.getByRole('dialog', { name: 'Foto 0' }).getByRole('img', { name: 'Foto 0' })).toBeVisible();
  expect(calls.completas).toBe(1);
});

test('avisa sobre foto incompatível antes de enviar', async ({ page }) => {
  const calls = mockApi(page);
  await page.goto(`/os/${OS_ID}?tab=fotos`);
  await page.locator('input[type="file"]').last().setInputFiles({ name: 'foto.heic', mimeType: 'image/heic', buffer: PNG });
  await expect(page.getByText(/precisa estar em JPEG, PNG ou WebP/)).toBeVisible();
  expect(calls.envios).toBe(0);
});

test('alinha resumo financeiro com painel de itens', async ({ page }) => {
  mockApi(page);
  await page.goto(`/os/${OS_ID}?tab=itens`);
  const painel = page.locator('section[class*="itemsSection"] > div').first();
  const resumo = page.locator('section[class*="financialSummary"]');
  await expect(painel).toBeVisible();
  await expect(resumo).toBeVisible();
  const painelBox = (await painel.boundingBox())!;
  const resumoBox = (await resumo.boundingBox())!;
  expect(Math.abs(painelBox.x - resumoBox.x)).toBeLessThan(1);
  expect(Math.abs(painelBox.width - resumoBox.width)).toBeLessThan(1);
});
