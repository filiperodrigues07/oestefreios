import { expect, test } from '@playwright/test';
import { abrirAba, aceitarAvisosDeSaida, criarOS, garantirSupervisor, login, SUPERVISOR } from './helpers.js';

test.describe('fluxo crítico da OS', () => {
  test.beforeAll(async ({ request }) => {
    await garantirSupervisor(request);
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('cria OS, grava diagnóstico e muda status', async ({ page }) => {
    await criarOS(page);
    await abrirAba(page, /Diagn/);

    await page.getByLabel('Diagnóstico').fill('pastilha gasta');
    await expect(page.getByText('Alterações não salvas')).toBeVisible();
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Alterações salvas.')).toBeVisible();
    await expect(page.getByText('Alterações não salvas')).toBeHidden();

    await page.reload();
    await abrirAba(page, /Diagn/);
    await expect(page.getByLabel('Diagnóstico')).toHaveValue('PASTILHA GASTA');

    const status = page.locator('select', { has: page.locator('option', { hasText: 'Aguardando peças' }) });
    await status.selectOption({ label: 'Aguardando peças' });
    await expect(page.getByText('Status alterado.')).toBeVisible();
  });

  test('avisa antes de sair com diagnóstico não salvo', async ({ page }) => {
    await criarOS(page);
    await abrirAba(page, /Diagn/);
    await page.getByLabel('Observações').fill('cliente aguardando');

    await page.getByRole('link', { name: 'Clientes' }).first().click();
    const dialogo = page.getByRole('dialog', { name: 'Sair sem salvar?' });
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole('button', { name: 'Continuar editando' }).click();

    await expect(page).toHaveURL(/\/os\//);
    await expect(page.getByLabel('Observações')).toHaveValue('CLIENTE AGUARDANDO');
  });

  test('rascunho sobrevive a recarregar a página', async ({ page }) => {
    aceitarAvisosDeSaida(page);
    await criarOS(page);
    await abrirAba(page, /Diagn/);
    await page.getByLabel('Serviço realizado').fill('troca das pastilhas');
    await page.waitForTimeout(800); // debounce do rascunho (500ms)

    await page.reload();
    await abrirAba(page, /Diagn/);
    await expect(page.getByText(/Há um rascunho não salvo/)).toBeVisible();
    await page.getByRole('button', { name: 'Restaurar' }).click();
    await expect(page.getByLabel('Serviço realizado')).toHaveValue('TROCA DAS PASTILHAS');
  });

  test('remover item e desfazer', async ({ page }) => {
    await criarOS(page);
    await abrirAba(page, /Produtos/);

    const codigo = page.getByPlaceholder('Código exato + Enter').first();
    await codigo.fill('00012345');
    await codigo.press('Enter');
    await page.getByRole('button', { name: 'Adicionar' }).click();
    await expect(page.getByText('Produto adicionado.')).toBeVisible();

    await page.getByRole('button', { name: 'Remover Filtro de óleo' }).click();
    await expect(page.getByRole('button', { name: 'Remover Filtro de óleo' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Desfazer' }).click();
    await expect(page.getByText('Produto restaurado.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remover Filtro de óleo' })).toBeVisible();
  });

  test('edição simultânea: quem salva por último escolhe qual versão fica', async ({ page, browser }) => {
    const id = await criarOS(page);
    const outro = await browser.newPage();
    await login(outro, SUPERVISOR);
    await outro.goto(`/os/${id}?tab=diagnostico`);
    await abrirAba(page, /Diagn/);

    await outro.getByLabel('Diagnóstico').fill('versão do outro');
    await page.getByLabel('Diagnóstico').fill('minha versão');

    await outro.getByRole('button', { name: 'Salvar' }).click();
    await expect(outro.getByText('Alterações salvas.')).toBeVisible();

    await page.getByRole('button', { name: 'Salvar' }).click();
    const conflito = page.getByRole('dialog', { name: 'Outro usuário alterou esta OS' });
    await expect(conflito).toBeVisible();
    await expect(page.getByLabel('Diagnóstico')).toHaveValue('MINHA VERSÃO');

    await conflito.getByRole('button', { name: 'Gravar a minha versão' }).click();
    await expect(page.getByText('Alterações salvas.')).toBeVisible();
    await outro.reload();
    await abrirAba(outro, /Diagn/);
    await expect(outro.getByLabel('Diagnóstico')).toHaveValue('MINHA VERSÃO');
    await outro.close();
  });
});
