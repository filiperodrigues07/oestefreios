import { expect, test, type Page } from '@playwright/test';
import { login } from './helpers.js';

/** Cabeçalhos visíveis da tabela de OS, na ordem da tela. */
async function cabecalhos(page: Page): Promise<string[]> {
  return (await page.locator('thead th[data-col]').allInnerTexts()).map((t) => t.replace(/[↕↑↓]/g, '').trim().toUpperCase());
}

test.describe('tabela tipo planilha', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    await page.goto('/os?situacaoDocumento=');
    await expect(page.locator('tbody tr').first()).toBeVisible();
    // Começa sempre do layout padrão (a preferência fica salva por usuário no navegador).
    await page.getByRole('button', { name: /^Colunas/ }).click();
    const restaurar = page.getByRole('button', { name: 'Restaurar padrão' });
    if (await restaurar.isEnabled()) await restaurar.click();
    await page.keyboard.press('Escape');
  });

  test('esconde coluna pelo botão "Colunas" e a escolha sobrevive a recarregar', async ({ page }) => {
    expect(await cabecalhos(page)).toContain('PLACA');
    await page.getByRole('button', { name: /^Colunas/ }).click();
    await page.getByRole('group', { name: 'Colunas da tabela' }).getByRole('checkbox', { name: 'Placa', exact: true }).uncheck();
    await expect(page.getByRole('button', { name: /Colunas \(1 oculta\)/ })).toBeVisible();
    expect(await cabecalhos(page)).not.toContain('PLACA');

    await page.reload();
    await expect(page.locator('tbody tr').first()).toBeVisible();
    expect(await cabecalhos(page)).not.toContain('PLACA');
  });

  test('arrastar o cabeçalho muda a ordem; clique curto continua ordenando', async ({ page }) => {
    const antes = await cabecalhos(page);
    expect(antes[0]).toBe('OS');

    const prioridade = page.locator('thead th[data-col="prioridade"]');
    const primeira = page.locator('thead th[data-col="numero"]');
    const de = (await prioridade.boundingBox())!;
    const para = (await primeira.boundingBox())!;
    await page.mouse.move(de.x + 20, de.y + de.height / 2);
    await page.mouse.down();
    await page.mouse.move(de.x - 40, de.y + de.height / 2, { steps: 5 });
    await page.mouse.move(para.x + 4, para.y + para.height / 2, { steps: 10 });
    await page.mouse.up();

    const depois = await cabecalhos(page);
    expect(depois[0]).toBe('PRIORIDADE');
    expect(depois[1]).toBe('OS');
    // O arraste não pode ter virado "ordenar por prioridade".
    await expect(prioridade).not.toHaveAttribute('aria-sort', /.+/);

    await page.locator('thead th[data-col="numero"] button').click();
    await expect(page.locator('thead th[data-col="numero"]')).toHaveAttribute('aria-sort', 'ascending');
  });

  test('pelo teclado: setas do botão "Colunas" reordenam', async ({ page }) => {
    await page.getByRole('button', { name: /^Colunas/ }).click();
    await page.getByRole('button', { name: 'Mover OS para baixo' }).click();
    expect((await cabecalhos(page)).slice(0, 2)).toEqual(['CÓD. CLI.', 'OS']);
  });

  test('redimensionar mostra a largura e grava', async ({ page }) => {
    const alca = page.getByRole('separator', { name: 'Largura da coluna Placa' });
    const caixa = (await alca.boundingBox())!;
    await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
    await page.mouse.down();
    await page.mouse.move(caixa.x + 60, caixa.y + caixa.height / 2, { steps: 8 });
    await expect(page.locator('[class*="guideLabel"]')).toHaveText(/\d+ px/);
    await page.mouse.up();
    const largura = (await page.locator('thead th[data-col="equipamentoDescricao"]').boundingBox())!.width;
    expect(largura).toBeGreaterThan(caixa.x - (await page.locator('thead th[data-col="equipamentoDescricao"]').boundingBox())!.x);
  });
});
