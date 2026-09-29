import { expect, test, type Page } from '@playwright/test';
import { login } from './helpers.js';

async function abrirProdutos(page: Page) {
  await page.goto('/os?situacaoDocumento=');
  await page.getByRole('row').filter({ has: page.getByRole('cell', { name: /^#\d+$/ }) }).first().click();
  await page.getByRole('tab', { name: /Produtos e Serviços/ }).click();
}

test('lista mostra produto zerado, mas bloqueia o lançamento com aviso', async ({ page }) => {
  await login(page, { email: 'mecanico@dev.local', senha: 'Mecanico@123456' });
  const chamadas: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/produtos?')) chamadas.push(request.url());
  });
  await abrirProdutos(page);
  await expect(page.getByRole('checkbox', { name: 'Somente produtos com saldo' })).toHaveCount(0);

  await page.getByPlaceholder('Descrição do produto').fill('junta');
  const opcao = page.getByRole('option', { name: /Junta do cabeçote/ });
  await expect(opcao).toBeVisible();
  expect(chamadas.some((url) => url.includes('saldoModo'))).toBe(false);

  await opcao.click();
  await expect(page.getByRole('alert').filter({ hasText: 'estoque zerado' })).toContainText('Verifique com o responsável');
  // Não foi para a etapa de quantidade: nada selecionado para lançar.
  await expect(page.getByRole('button', { name: /^Adicionar/ })).toHaveCount(0);

  // Pelo código também bloqueia.
  await page.getByPlaceholder('Cód. CH + Enter').first().fill('00012359');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'estoque zerado' })).toBeVisible();
});
