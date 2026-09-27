import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getWhatsappSettings } from '../whatsappSettings.service.js';
import { getEvolutionConnection, getEvolutionQr, sendEvolutionPdf, sendEvolutionText } from '../evolution.service.js';

vi.mock('../whatsappSettings.service.js', () => ({ getWhatsappSettings: vi.fn() }));

describe('Evolution API', () => {
  beforeEach(() => {
    vi.mocked(getWhatsappSettings).mockResolvedValue({
      baseUrl: 'http://127.0.0.1:8080', apiKey: 'chave-teste', instanceName: 'oficina',
      templates: {} as never, automatic: {} as never, automaticEmail: {} as never,
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('consulta conexão e QR pelo servidor sem expor chave ao frontend', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ instance: { state: 'open' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ base64: 'aGVsbG8=', pairingCode: '12345678' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await getEvolutionConnection()).toEqual({ state: 'open' });
    expect(await getEvolutionQr()).toEqual({ base64: 'data:image/png;base64,aGVsbG8=', pairingCode: '12345678' });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://127.0.0.1:8080/instance/connectionState/oficina');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://127.0.0.1:8080/instance/connect/oficina');
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ apikey: 'chave-teste' });
  });

  it('envia texto ao número salvo e preserva o identificador retornado', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ key: { id: 'msg-123' } }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await sendEvolutionText('5511912345678', 'OS pronta')).toBe('msg-123');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://127.0.0.1:8080/message/sendText/oficina');
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body)).toEqual({ number: '5511912345678', text: 'OS pronta' });
  });

  it('envia PDF como documento com a mensagem na legenda', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ key: { id: 'pdf-123' } }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await sendEvolutionPdf('5511912345678', '*OS #123*', Buffer.from('%PDF-1.7'), 'os-123.pdf')).toBe('pdf-123');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://127.0.0.1:8080/message/sendMedia/oficina');
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body)).toEqual({
      number: '5511912345678', mediatype: 'document', mimetype: 'application/pdf',
      caption: '*OS #123*', media: Buffer.from('%PDF-1.7').toString('base64'), fileName: 'os-123.pdf',
    });
  });

  it('mostra erro específico quando a Evolution recusa o PDF', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 422 })));
    await expect(sendEvolutionPdf('5511912345678', 'OS', Buffer.from('%PDF-1.7'), 'os.pdf'))
      .rejects.toMatchObject({ code: 'WHATSAPP_PDF_REJECTED', statusCode: 502 });
  });

  it('traduz falha de autenticação em erro operacional amigável', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    await expect(sendEvolutionText('5511912345678', 'OS pronta')).rejects.toMatchObject({ code: 'WHATSAPP_AUTH_FAILED', statusCode: 502 });
  });
});
