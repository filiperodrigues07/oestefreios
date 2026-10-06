import { expect, test } from '@playwright/test';
import { criarOS, login } from './helpers.js';

/** "Diagnóstico de abertura" (problema relatado) editável depois da OS aberta, como no CHERP. */
test('diagnóstico de abertura: edita depois de abrir a OS', async ({ page }) => {
  await login(page);
  await criarOS(page, 'BARULHO NO FREIO');
  await expect(page.getByRole('heading', { name: 'Diagnóstico de abertura' })).toBeVisible();
  await expect(page.getByText('Problema relatado')).toHaveCount(0);

  const campo = page.getByLabel('Diagnóstico de abertura');
  await expect(campo).toHaveValue('BARULHO NO FREIO');
  await campo.fill('barulho no freio traseiro esquerdo');
  await page.getByRole('button', { name: 'Salvar diagnóstico de abertura' }).click();
  await expect(page.getByText('Diagnóstico de abertura salvo.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Diagnóstico de abertura')).toHaveValue('BARULHO NO FREIO TRASEIRO ESQUERDO');
});

/** WhatsApp: modelo fixo em "Resumo financeiro" e PDF da OS sempre anexado. */
test('whatsapp: modelo fixo e PDF sempre anexado', async ({ page }) => {
  await login(page);
  await criarOS(page);
  await page.getByRole('button', { name: 'Imprimir / Enviar' }).click();
  await page.getByRole('menuitem', { name: 'Enviar por WhatsApp' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Enviar OS por WhatsApp' });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByText('Resumo financeiro')).toBeVisible();
  await expect(dialogo.getByLabel('Tipo de mensagem')).toHaveCount(0);
  const anexar = dialogo.getByRole('checkbox', { name: /Anexar PDF da OS/ });
  await expect(anexar).toBeChecked();
  await expect(anexar).toBeDisabled();
});
