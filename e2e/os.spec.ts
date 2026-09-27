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

test.describe('reabrir OS', () => {
  test('gerente finaliza por engano e reabre com motivo', async ({ page }) => {
    await login(page);
    await criarOS(page);

    await page.getByRole('button', { name: 'Finalizar OS' }).click();
    const finalizar = page.getByRole('dialog', { name: 'Finalizar OS?' });
    await expect(finalizar).toContainText('não pode mais ser editada');
    await finalizar.getByRole('button', { name: 'Finalizar OS' }).click();
    await expect(page.getByText('Status alterado.')).toBeVisible();

    await page.getByRole('button', { name: 'Reabrir OS' }).click();
    const reabrir = page.getByRole('dialog', { name: /Reabrir OS/ });
    await reabrir.getByRole('textbox').fill('Finalizada por engano');
    await reabrir.getByRole('button', { name: 'Reabrir OS' }).click();
    await expect(page.getByText('OS reaberta. Já pode editar de novo.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Finalizar OS' })).toBeVisible();

    await abrirAba(page, /Histórico/);
    await expect(page.getByText(/OS reaberta \(motivo: Finalizada por engano\)/)).toBeVisible();
  });
});

test.describe('OS finalizada some para quem não tem a permissão', () => {
  test('mecânico finaliza e a OS sai da lista dele; admin vê como "Finalizada no app"', async ({ page, browser }) => {
    await login(page);
    const id = await criarOS(page, 'SOME DA LISTA');

    const mecanicoPage = await browser.newPage();
    await login(mecanicoPage, { email: 'mecanico@dev.local', senha: 'Mecanico@123456' });
    await mecanicoPage.goto(`/os/${id}`);
    await mecanicoPage.getByRole('button', { name: 'Finalizar OS' }).click();
    await mecanicoPage.getByRole('dialog', { name: 'Finalizar OS?' }).getByRole('button', { name: 'Finalizar OS' }).click();
    await expect(mecanicoPage.getByText('OS finalizada. Ela saiu da sua lista.')).toBeVisible();
    await expect(mecanicoPage).toHaveURL(/\/os$/);
    await expect(mecanicoPage.locator(`[href="/os/${id}"]`)).toHaveCount(0);
    await expect(mecanicoPage.getByRole('combobox', { name: 'Situação' })).toHaveCount(0);

    // Link direto continua abrindo, só leitura.
    await mecanicoPage.goto(`/os/${id}`);
    await expect(mecanicoPage.getByRole('button', { name: 'Finalizar OS' })).toHaveCount(0);
    await mecanicoPage.close();

    await page.goto('/os');
    await page.getByRole('combobox', { name: 'Situação' }).selectOption({ label: 'Finalizada no app' });
    // Toda linha desse filtro é "Finalizada no app", e a OS que o mecânico finalizou está entre elas.
    const linhas = page.locator('tbody tr:visible');
    await expect(linhas.first()).toBeVisible();
    await expect(linhas.filter({ hasNotText: 'Finalizada no app' })).toHaveCount(0);
    const ids: string[] = [];
    const total = await linhas.count();
    for (let i = 0; i < total; i++) {
      await linhas.nth(i).click();
      await page.waitForURL(/\/os\/[0-9a-f-]{36}$/);
      ids.push(page.url().split('/os/')[1]!);
      await page.goBack();
      await expect(linhas.first()).toBeVisible();
    }
    expect(ids).toContain(id);
  });
});
