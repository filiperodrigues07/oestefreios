import { describe, expect, it } from 'vitest';
import type { OrdemServico } from '../../types/cherp.types.js';
import { formatOsEmailBody, normalizeWhatsappNumber, renderOsMessage, sendManualOsMessage } from '../osCommunication.service.js';
import { DEFAULT_WHATSAPP_SETTINGS, whatsappSettingsSchema } from '../whatsappSettings.service.js';

const os = {
  id: 'os-1', numero: 123, equipamentoDescricao: 'ABC-1234 · Onix', status: 'CONCLUIDA',
  produtos: [{ produtoCodigo: '1', descricao: 'Peça', unidade: 'UN', quantidade: 1, total: 120 }],
  servicos: [{ servicoCodigo: '2', descricao: 'Serviço', unidade: 'UN', quantidade: 1, total: 80 }],
  faturamento: 200,
} as OrdemServico;

describe('mensagens da OS', () => {
  it('aceita celular brasileiro com e sem código do país e rejeita número incompleto', () => {
    expect(normalizeWhatsappNumber('(11) 91234-5678')).toBe('5511912345678');
    expect(normalizeWhatsappNumber('+55 11 91234-5678')).toBe('5511912345678');
    expect(normalizeWhatsappNumber('1234')).toBeNull();
  });

  it('monta resumo financeiro com valores da OS e não injeta valores em status', () => {
    const summary = renderOsMessage(DEFAULT_WHATSAPP_SETTINGS.templates.resumo_financeiro, os, 'Maria', 'resumo_financeiro');
    expect(summary).toContain('📦 *Produtos*');
    expect(summary).toContain('🔧 *Serviços realizados*');
    expect(summary).toContain('• 1 UN — Peça: *R$ 120,00*');
    expect(summary).toContain('• 1 UN — Serviço: *R$ 80,00*');
    expect(summary).toContain('💰 *Total: R$ 200,00*');
    expect(renderOsMessage('OS #{os}: {total}', os, 'Maria', 'pronta')).toBe('OS #123: ');
  });

  it('mostra quantidade e preço unitário sem inventar valores ausentes', () => {
    const partial = {
      ...os,
      produtos: [{ produtoCodigo: '1', descricao: 'Pastilha', unidade: 'UN', quantidade: 2, precoUnitario: 50, total: 100 }],
      servicos: [{ servicoCodigo: '2', descricao: 'Instalação', unidade: 'UN', quantidade: 1 }],
      faturamento: undefined,
    } as OrdemServico;
    const summary = renderOsMessage(DEFAULT_WHATSAPP_SETTINGS.templates.resumo_financeiro, partial, 'Maria', 'resumo_financeiro');
    expect(summary).toContain('2 UN — Pastilha (R$ 50,00/un.): *R$ 100,00*');
    expect(summary).toContain('1 UN — Instalação: *a confirmar*');
    expect(summary).toContain('Total: a confirmar');
  });

  it('converte o destaque do WhatsApp em negrito seguro no e-mail', () => {
    const email = formatOsEmailBody('🧾 *OS #123*\nTotal: *R$ 200,00* <cliente>');
    expect(email.text).toBe('🧾 OS #123\nTotal: R$ 200,00 <cliente>');
    expect(email.html).toContain('<strong>OS #123</strong>');
    expect(email.html).toContain('<strong>R$ 200,00</strong>');
    expect(email.html).toContain('&lt;cliente&gt;');
    expect(email.html).not.toContain('<cliente>');
  });

  it('rejeita anexo opcional no canal de e-mail, que já inclui o PDF', async () => {
    await expect(sendManualOsMessage('os-1', 'email', 'aberta', {} as never, false, {}, true))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('impede valores financeiros e variáveis desconhecidas em modelos de status', () => {
    expect(whatsappSettingsSchema.safeParse(DEFAULT_WHATSAPP_SETTINGS).success).toBe(true);
    const invalid = {
      ...DEFAULT_WHATSAPP_SETTINGS,
      templates: { ...DEFAULT_WHATSAPP_SETTINGS.templates, pronta: 'OS pronta: {total}' },
    };
    expect(whatsappSettingsSchema.safeParse(invalid).success).toBe(false);
    expect(whatsappSettingsSchema.safeParse({ ...invalid, templates: { ...invalid.templates, pronta: '{itens}' } }).success).toBe(false);
    expect(whatsappSettingsSchema.safeParse({ ...invalid, templates: { ...invalid.templates, pronta: '{senha}' } }).success).toBe(false);
  });
});
