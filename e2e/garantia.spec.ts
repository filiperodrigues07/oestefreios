import { expect, test } from '@playwright/test';
import { criarOS, login } from './helpers.js';

/** Garantia da OS (campo GARANTIA do CHERP): nasce com a data de abertura (hoje) e dá para ajustar e voltar. */
test('garantia: nasce com a data de abertura, altera e volta para ela', async ({ page }) => {
  await login(page);
  await page.goto('/os/nova');
  const hoje = await page.getByLabel('Garantia até').inputValue();
  expect(hoje).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  await criarOS(page);
  const campo = page.getByLabel('Garantia até');
  await expect(campo).toHaveValue(hoje);

  await campo.fill('2031-07-20');
  await page.getByRole('button', { name: 'Salvar garantia' }).click();
  await expect(page.getByText('Garantia salva.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Garantia até')).toHaveValue('2031-07-20');

  await page.getByRole('button', { name: 'Usar data de abertura' }).click();
  await expect(page.getByLabel('Garantia até')).toHaveValue(hoje);
  await page.getByRole('button', { name: 'Salvar garantia' }).click();
  await expect(page.getByText('Garantia salva.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Garantia até')).toHaveValue(hoje);
});
