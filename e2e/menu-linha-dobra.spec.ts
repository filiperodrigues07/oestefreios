/** Regressão: o scroll que leva a linha até a tela chega logo após o clique e fechava o menu (falhou no CI, Linux). */
import { expect, test } from '@playwright/test';
import { login } from './helpers.js';

test('menu de ações abre mesmo com a linha abaixo da dobra (celular)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 520 });
  await login(page);
  await page.goto('/os?situacaoDocumento=');
  const botao = page.getByRole('button', { name: /^Ações da OS #/ }).first();
  await expect(botao).toBeVisible();
  await botao.click();
  await expect(page.getByRole('menu').getByRole('menuitem').first()).toHaveText('Visualizar / baixar PDF');
});
