import { expect, test, type Page } from '@playwright/test';
import { login } from './helpers.js';

async function abrirProdutos(page: Page) {
  await page.goto('/os?situacaoDocumento=');
  await page.getByRole('row').filter({ has: page.getByRole('cell', { name: /^#\d+$/ }) }).first().click();
  await page.getByRole('tab', { name: /Produtos e Serviços/ }).click();
}

test.describe('busca tolerante de produtos e serviços', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    await abrirProdutos(page);
  });

  test('plural acha o produto sem selo "parecido"', async ({ page }) => {
    await page.getByPlaceholder('Descrição do produto').fill('filtros');
    const opcao = page.getByRole('option', { name: /Filtro de óleo/ });
    await expect(opcao).toBeVisible();
    await expect(opcao).not.toContainText('parecido');
  });

  test('erro de digitação ainda acha e avisa que é parecido', async ({ page }) => {
    await page.getByPlaceholder('Descrição do produto').fill('pastlha');
    const opcao = page.getByRole('option', { name: /Pastilha de freio dianteira/ });
    await expect(opcao).toBeVisible();
    await expect(opcao).toContainText('parecido');
    await page.screenshot({ path: 'test-results/busca-parecido.png' });
  });

  test('sem resultado explica o que fazer', async ({ page }) => {
    await page.getByPlaceholder('Descrição do produto').fill('zzzzqqqq');
    await expect(page.getByText('Nada encontrado. Tente menos palavras ou só parte do nome.')).toBeVisible();
  });

  test('serviço também perdoa erro de digitação', async ({ page }) => {
    await page.getByPlaceholder('Descrição do serviço').fill('alinhmento');
    await expect(page.getByRole('option', { name: /Alinhamento e balanceamento/ })).toContainText('parecido');
  });
});
