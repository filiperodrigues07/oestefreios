import { expect, test } from '@playwright/test';
import { login } from './helpers.js';

/** Coluna Ações da lista de OS: lápis + "⋯" com imprimir, enviar, duplicar e excluir. */
for (const [nome, viewport] of [['desktop', { width: 1440, height: 900 }], ['celular', { width: 390, height: 844 }]] as const) {
  test(`menu de ações da linha (${nome})`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await login(page);
    await page.goto('/os?situacaoDocumento=');

    const botao = page.getByRole('button', { name: /^Ações da OS #/ }).first();
    await expect(botao).toBeVisible();
    await botao.click();

    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem').first()).toHaveText('Visualizar / baixar PDF');
    await expect(menu.getByRole('menuitem', { name: 'Enviar por WhatsApp' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Enviar por e-mail' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Duplicar OS' })).toBeVisible();
    await page.screenshot({ path: `test-results/os-acoes-${nome}.png` });

    // Clicar no item não pode abrir a OS (evento do portal sobe pela linha).
    const url = page.url();
    await menu.getByRole('menuitem', { name: 'Enviar por e-mail' }).click();
    await expect(page.getByRole('dialog', { name: 'Enviar OS por e-mail' })).toBeVisible();
    expect(page.url()).toBe(url);

    // Esc fecha o diálogo; teclado abre o menu e Esc devolve o foco ao botão.
    await page.keyboard.press('Escape');
    await botao.focus();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(botao).toBeFocused();
  });

  test(`cabeçalho da OS: Imprimir / Enviar num botão só (${nome})`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await login(page);
    await page.goto('/os?situacaoDocumento=');
    await page.getByRole('link', { name: /^Editar OS #/ }).first().click();

    const botao = page.getByRole('button', { name: 'Imprimir / Enviar' });
    await expect(botao).toBeVisible();
    // Os ícones soltos ao lado do cliente saíram: enviar fica só no menu.
    await expect(page.getByRole('group', { name: 'Enviar OS ao cliente' })).toHaveCount(0);

    await botao.click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem')).toHaveText(['Visualizar / baixar PDF', 'Enviar por WhatsApp', 'Enviar por e-mail']);
    await page.screenshot({ path: `test-results/os-cabecalho-${nome}.png` });

    await menu.getByRole('menuitem', { name: 'Enviar por WhatsApp' }).click();
    await expect(page.getByRole('dialog', { name: 'Enviar OS por WhatsApp' })).toBeVisible();
  });
}
