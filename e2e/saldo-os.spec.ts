import { expect, test, type Page } from '@playwright/test';
import { login } from './helpers.js';

async function abrirProdutos(page: Page) {
  await page.goto('/os?situacaoDocumento=');
  await page.getByRole('row').filter({ has: page.getByRole('cell', { name: /^#\d+$/ }) }).first().click();
  await page.getByRole('tab', { name: /Produtos e Serviços/ }).click();
  return page.getByRole('checkbox', { name: 'Somente produtos com saldo' });
}

test('admin pode desligar o filtro de saldo, marcado por padrão', async ({ page }) => {
  await login(page);
  const checkbox = await abrirProdutos(page);
  await expect(checkbox).toBeChecked();
  await expect(checkbox).toBeEnabled();
  await checkbox.uncheck();
  await expect(checkbox).not.toBeChecked();
});

test('funcionário usa filtro de saldo e não pode desligá-lo', async ({ page }) => {
  await login(page, { email: 'mecanico@dev.local', senha: 'Mecanico@123456' });
  const chamadas: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/produtos?')) chamadas.push(request.url());
  });
  const checkbox = await abrirProdutos(page);
  await expect(checkbox).toBeChecked();
  await expect(checkbox).toBeDisabled();
  await expect.poll(() => chamadas.some((url) => url.includes('saldoModo=com_saldo'))).toBe(true);
});
