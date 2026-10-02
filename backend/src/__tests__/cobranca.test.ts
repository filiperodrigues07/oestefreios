import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn().mockResolvedValue({ messageId: 'x' }) }));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail }) } }));

import { hashPassword } from '../auth/password.js';
import { app } from '../app.js';
import { pool } from '../database/postgres/client.js';
import { hojeIso, normalizarCobranca } from '../services/billing.service.js';
import { ehPdf, executarLembretes, lembreteDevido, montarEmailBoleto, nomeSeguro, referenciasSeguidas, vencimentoDoMes } from '../services/cobranca.service.js';
import { soltarBilling, travarBilling } from './billingLock.js';

const senha = 'Teste@123456';
const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

describe('regras puras de cobrança', () => {
  it('reconhece PDF pela assinatura, não pela extensão', () => {
    expect(ehPdf(pdf)).toBe(true);
    expect(ehPdf(Buffer.from('<html>oi</html> conteudo qualquer'))).toBe(false);
    expect(ehPdf(Buffer.from('%PDF'))).toBe(false);
  });

  it('sanitiza o nome do arquivo', () => {
    expect(nomeSeguro('Boleto Inter (setembro).pdf')).toBe('Boleto-Inter-setembro.pdf');
    expect(nomeSeguro('../../etc/passwd')).toBe('etcpasswd.pdf');
    expect(nomeSeguro('')).toBe('boleto.pdf');
  });

  it('escapa HTML da mensagem no e-mail e formata mês, valor e vencimento', () => {
    const { assunto, html } = montarEmailBoleto({ referencia: '2026-09', vencimento: '2026-10-10', valor: 300 }, 'Rodrigues Tech', '<script>alert(1)</script>\nobrigado');
    expect(assunto).toContain('09/2026');
    expect(assunto).toContain('10/10/2026');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<br>');
    expect(html).toMatch(/R\$\s?300,00/);
    expect(html).not.toContain('Linha digitável');
  });

  it('inclui linha digitável e PIX escapados e muda o texto nos lembretes', () => {
    const base = { referencia: '2026-09', vencimento: '2026-10-10', valor: 300, linhaDigitavel: '07790.00116 12345.678901', pixCopiaCola: '000201<b>' };
    const boleto = montarEmailBoleto(base, 'Rodrigues Tech', '');
    expect(boleto.html).toContain('07790.00116 12345.678901');
    expect(boleto.html).toContain('000201&lt;b&gt;');
    expect(montarEmailBoleto(base, 'RT', '', 'ANTES').assunto).toContain('lembrete');
    expect(montarEmailBoleto(base, 'RT', '', 'VENCIDA').assunto).toContain('venceu em 10/10/2026');
  });

  it('gera meses seguidos virando o ano e respeita o fim do mês no vencimento', () => {
    expect(referenciasSeguidas('2026-11', 4)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(vencimentoDoMes('2027-02', 31)).toBe('2027-02-28');
    expect(vencimentoDoMes('2026-10', 10)).toBe('2026-10-10');
  });

  it('decide o lembrete do dia sem repetir e sem incomodar quem já pagou', () => {
    const regras = { ativo: true, diasAntes: 3, aposVencimento: true };
    const boleto = normalizarCobranca({ id: 'x', referencia: '2026-10', vencimento: '2026-10-10', valor: 300, arquivoNome: 'b.pdf', arquivoTamanho: 10 });
    expect(lembreteDevido(boleto, '2026-10-05', regras)).toBeNull();
    expect(lembreteDevido(boleto, '2026-10-07', regras)).toBe('ANTES');
    expect(lembreteDevido({ ...boleto, lembretes: ['ANTES'] }, '2026-10-09', regras)).toBeNull();
    expect(lembreteDevido({ ...boleto, enviadoEm: '2026-10-08T12:00:00.000Z' }, '2026-10-09', regras)).toBeNull();
    expect(lembreteDevido(boleto, '2026-10-12', regras)).toBe('VENCIDA');
    expect(lembreteDevido(boleto, '2026-10-12', { ...regras, aposVencimento: false })).toBeNull();
    expect(lembreteDevido(boleto, '2026-11-30', regras)).toBeNull();
    expect(lembreteDevido({ ...boleto, pagoEm: '2026-10-09' }, '2026-10-12', regras)).toBeNull();
    expect(lembreteDevido({ ...boleto, arquivoNome: null }, '2026-10-07', regras)).toBeNull();
  });
});

describe('cobranças por boleto (API)', () => {
  let donoId = '';
  let donoToken = '';
  let outroId = '';
  let outroToken = '';
  let billingOriginal: unknown = null;
  let cobrancaOriginal: unknown = null;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const campos = { referencia: '2026-09', vencimento: '2026-10-10', valor: '300', observacao: 'teste' };

  async function conta(nome: string, superAdmin: boolean) {
    const id = randomUUID();
    const email = `${nome}-${id}@test.local`;
    const role = await pool.query<{ id: string }>("SELECT id FROM roles WHERE name = 'Administrador'");
    await pool.query('INSERT INTO users (id, name, email, password_hash, role_id, is_super_admin) VALUES ($1, $2, $3, $4, $5, $6)', [id, nome, email, await hashPassword(senha), role.rows[0]?.id, superAdmin]);
    await pool.query("INSERT INTO user_permissions (user_id, permission_id) SELECT $1, id FROM permissions WHERE code IN ('SYSTEM_SETTINGS','OS_VIEW')", [id]);
    const login = await request(app).post('/api/auth/login').send({ email, password: senha });
    return { id, token: login.body.data.accessToken as string };
  }

  beforeAll(async () => {
    await travarBilling();
    billingOriginal = (await pool.query("SELECT data FROM settings WHERE category = 'billing'")).rows[0]?.data ?? null;
    cobrancaOriginal = (await pool.query("SELECT data FROM settings WHERE category = 'cobranca'")).rows[0]?.data ?? null;
    await pool.query("DELETE FROM settings WHERE category = 'cobranca'");
    ({ id: donoId, token: donoToken } = await conta('dono-cobranca', true));
    ({ id: outroId, token: outroToken } = await conta('outro-cobranca', false));
  });

  afterAll(async () => {
    await soltarBilling();
    if (billingOriginal) await pool.query("UPDATE settings SET data = $1 WHERE category = 'billing'", [billingOriginal]);
    else await pool.query("DELETE FROM settings WHERE category = 'billing'");
    if (cobrancaOriginal) await pool.query("UPDATE settings SET data = $1 WHERE category = 'cobranca'", [cobrancaOriginal]);
    else await pool.query("DELETE FROM settings WHERE category = 'cobranca'");
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [[donoId, outroId]]);
    await pool.end();
  });

  it('só o proprietário mexe em cobranças (404 para os demais)', async () => {
    const criar = await request(app).post('/api/billing/cobrancas').set(auth(outroToken)).field(campos).attach('arquivo', pdf, { filename: 'b.pdf', contentType: 'application/pdf' });
    expect(criar.status).toBe(404);
    expect((await request(app).get('/api/billing/cobranca-config').set(auth(outroToken))).status).toBe(404);
  });

  it('recusa arquivo que não é PDF', async () => {
    const falso = await request(app).post('/api/billing/cobrancas').set(auth(donoToken)).field(campos).attach('arquivo', Buffer.from('<html>nao sou pdf, so finjo</html>'), { filename: 'boleto.pdf', contentType: 'application/pdf' });
    expect(falso.status).toBe(400);
  });

  it('cria sem PDF, bloqueia mês repetido, edita, anexa depois e só então envia', async () => {
    const criar = await request(app).post('/api/billing/cobrancas').set(auth(donoToken)).field({ ...campos, linhaDigitavel: '0779 0001' });
    expect(criar.status).toBe(201);
    const id = criar.body.data.id as string;
    expect(criar.body.data).toMatchObject({ arquivoNome: null, arquivoTamanho: null, linhaDigitavel: '0779 0001', lembretes: [] });

    expect((await request(app).post('/api/billing/cobrancas').set(auth(donoToken)).field(campos)).status).toBe(400);
    expect((await request(app).get(`/api/billing/cobrancas/${id}/arquivo`).set(auth(donoToken))).status).toBe(404);
    expect((await request(app).post(`/api/billing/cobrancas/${id}/enviar`).set(auth(donoToken)).send({})).status).toBe(400);

    const editar = await request(app).put(`/api/billing/cobrancas/${id}`).set(auth(donoToken)).send({ ...campos, valor: 350, vencimento: '2026-10-12' });
    expect(editar.status).toBe(200);
    expect(editar.body.data).toMatchObject({ valor: 350, vencimento: '2026-10-12' });
    expect((await request(app).put(`/api/billing/cobrancas/${id}`).set(auth(outroToken)).send(campos)).status).toBe(404);

    expect((await request(app).post(`/api/billing/cobrancas/${id}/arquivo`).set(auth(donoToken)).attach('arquivo', Buffer.from('nada de pdf aqui'), { filename: 'x.pdf', contentType: 'application/pdf' })).status).toBe(400);
    const anexar = await request(app).post(`/api/billing/cobrancas/${id}/arquivo`).set(auth(donoToken)).attach('arquivo', pdf, { filename: 'Boleto Outubro.pdf', contentType: 'application/pdf' });
    expect(anexar.status).toBe(200);
    expect(anexar.body.data).toMatchObject({ arquivoNome: 'Boleto-Outubro.pdf', arquivoTamanho: pdf.length });
    expect(existsSync(resolve(process.cwd(), 'storage', 'cobrancas', `${id}.pdf`))).toBe(true);
    expect((await request(app).get(`/api/billing/cobrancas/${id}/arquivo`).set(auth(donoToken))).status).toBe(200);

    expect((await request(app).delete(`/api/billing/cobrancas/${id}`).set(auth(donoToken))).status).toBe(200);
  });

  it('gera os próximos meses pulando os que já têm cobrança', async () => {
    const antes = await request(app).get('/api/billing').set(auth(donoToken));
    const assinatura = antes.body.data;
    const dados = {
      cliente: assinatura.cliente, plano: assinatura.plano, valorMensal: 250, vencimentoAtual: assinatura.vencimentoAtual,
      diaVencimento: 31, carenciaDias: assinatura.carenciaDias, avisoDias: assinatura.avisoDias,
      observacaoInterna: assinatura.observacaoInterna, mensagemCliente: assinatura.mensagemCliente,
    };
    expect((await request(app).put('/api/billing').set(auth(donoToken)).send(dados)).status).toBe(200);
    const existente = await request(app).post('/api/billing/cobrancas').set(auth(donoToken)).field({ ...campos, referencia: '2031-01' });
    expect(existente.status).toBe(201);

    const gerar = await request(app).post('/api/billing/cobrancas/gerar').set(auth(donoToken)).send({ inicio: '2030-12', meses: 3 });
    expect(gerar.status).toBe(201);
    const criadas = gerar.body.data.criadas as { id: string; referencia: string; vencimento: string; valor: number; arquivoNome: string | null }[];
    expect(criadas.map((item) => item.referencia)).toEqual(['2030-12', '2031-02']);
    expect(gerar.body.data.puladas).toEqual(['2031-01']);
    expect(criadas[1]).toMatchObject({ vencimento: '2031-02-28', valor: 250, arquivoNome: null });
    expect((await request(app).post('/api/billing/cobrancas/gerar').set(auth(donoToken)).send({ inicio: '2030-12', meses: 13 })).status).toBe(400);

    for (const id of [existente.body.data.id as string, ...criadas.map((item) => item.id)]) {
      expect((await request(app).delete(`/api/billing/cobrancas/${id}`).set(auth(donoToken))).status).toBe(200);
    }
    expect((await request(app).put('/api/billing').set(auth(donoToken)).send({ ...dados, valorMensal: assinatura.valorMensal, diaVencimento: assinatura.diaVencimento })).status).toBe(200);
  });

  it('desfaz a baixa: reabre o boleto, tira o pagamento e volta o vencimento', async () => {
    const criar = await request(app).post('/api/billing/cobrancas').set(auth(donoToken)).field(campos);
    const id = criar.body.data.id as string;
    const antes = await request(app).get('/api/billing').set(auth(donoToken));
    expect((await request(app).post(`/api/billing/cobrancas/${id}/desfazer-baixa`).set(auth(donoToken))).status).toBe(400);

    const pagar = await request(app).post('/api/billing/pagamentos').set(auth(donoToken)).send({ data: '2026-10-05', referencia: '2026-09', valor: 300, forma: 'PIX', observacao: '', cobrancaId: id });
    expect(pagar.status).toBe(200);
    expect(pagar.body.data.vencimentoAtual).not.toBe(antes.body.data.vencimentoAtual);

    const desfazer = await request(app).post(`/api/billing/cobrancas/${id}/desfazer-baixa`).set(auth(donoToken));
    expect(desfazer.status).toBe(200);
    expect(desfazer.body.data.vencimentoRestaurado).toBe(true);
    expect(desfazer.body.data.vencimentoAtual).toBe(antes.body.data.vencimentoAtual);
    expect(desfazer.body.data.pagamentos).toEqual(antes.body.data.pagamentos);
    expect((desfazer.body.data.cobrancas as { id: string; pagoEm: string | null }[]).find((item) => item.id === id)?.pagoEm).toBeNull();

    // Remover o pagamento pela aba Assinatura também reabre o boleto.
    const pagarDeNovo = await request(app).post('/api/billing/pagamentos').set(auth(donoToken)).send({ data: '2026-10-06', referencia: '2026-09', valor: 300, forma: 'PIX', observacao: '', cobrancaId: id });
    const pagamentoId = (pagarDeNovo.body.data.pagamentos as { id: string }[])[0]!.id;
    const remover = await request(app).delete(`/api/billing/pagamentos/${pagamentoId}`).set(auth(donoToken));
    expect(remover.status).toBe(200);
    expect((remover.body.data.cobrancas as { id: string; pagoEm: string | null }[]).find((item) => item.id === id)?.pagoEm).toBeNull();

    expect((await request(app).put('/api/billing').set(auth(donoToken)).send({
      ...Object.fromEntries(['cliente', 'plano', 'valorMensal', 'diaVencimento', 'carenciaDias', 'avisoDias', 'observacaoInterna', 'mensagemCliente'].map((k) => [k, antes.body.data[k]])),
      vencimentoAtual: antes.body.data.vencimentoAtual,
    })).status).toBe(200);
    expect((await request(app).delete(`/api/billing/cobrancas/${id}`).set(auth(donoToken))).status).toBe(200);
  });

  it('anexa, baixa, configura o e-mail, envia com anexo e cópia oculta, marca como paga e remove', async () => {
    const criar = await request(app).post('/api/billing/cobrancas').set(auth(donoToken)).field(campos).attach('arquivo', pdf, { filename: 'Boleto Inter (setembro).pdf', contentType: 'application/pdf' });
    expect(criar.status).toBe(201);
    const cobranca = criar.body.data as { id: string; arquivoNome: string };
    expect(cobranca.arquivoNome).toBe('Boleto-Inter-setembro.pdf');
    expect(existsSync(resolve(process.cwd(), 'storage', 'cobrancas', `${cobranca.id}.pdf`))).toBe(true);

    const baixar = await request(app).get(`/api/billing/cobrancas/${cobranca.id}/arquivo`).set(auth(donoToken)).buffer(true).parse((res, cb) => {
      const partes: Buffer[] = [];
      res.on('data', (parte: Buffer) => partes.push(parte));
      res.on('end', () => cb(null, Buffer.concat(partes)));
    });
    expect(baixar.status).toBe(200);
    expect(baixar.headers['content-type']).toContain('application/pdf');
    expect(Buffer.compare(baixar.body as Buffer, pdf)).toBe(0);
    expect((await request(app).get(`/api/billing/cobrancas/${cobranca.id}/arquivo`).set(auth(outroToken))).status).toBe(404);

    // sem SMTP nem e-mails: recusa com mensagem clara e sem enviar nada
    const semConfig = await request(app).post(`/api/billing/cobrancas/${cobranca.id}/enviar`).set(auth(donoToken)).send({});
    expect(semConfig.status).toBe(400);
    expect(sendMail).not.toHaveBeenCalled();

    const config = {
      emails: ['financeiro@cliente.com.br'],
      copiaOculta: 'dono@rodriguestech.com.br',
      smtp: { host: 'smtp.teste.local', port: 587, seguranca: 'starttls', user: 'dono@rodriguestech.com.br', password: 'segredo-super', fromEmail: 'dono@rodriguestech.com.br', fromName: 'Rodrigues Tech' },
    };
    const salvo = await request(app).put('/api/billing/cobranca-config').set(auth(donoToken)).send(config);
    expect(salvo.status).toBe(200);
    expect(salvo.body.data.smtp.password).toBe('••••••••');
    const gravado = await pool.query("SELECT data->'smtp'->>'password' AS senha FROM settings WHERE category = 'cobranca'");
    expect(gravado.rows[0]?.senha).toMatch(/^enc:v1:/);
    // Senha salva nunca volta em texto puro: não existe mais rota pra revelar.
    const revelada = await request(app).get('/api/billing/cobranca-config/senha').set(auth(donoToken));
    expect(revelada.status).toBe(404);
    expect(JSON.stringify(revelada.body)).not.toContain('segredo-super');

    const enviar = await request(app).post(`/api/billing/cobrancas/${cobranca.id}/enviar`).set(auth(donoToken)).send({ mensagem: 'Qualquer dúvida, responda.' });
    expect(enviar.status).toBe(200);
    expect(enviar.body.data).toMatchObject({ envios: 1, enviadoPara: ['financeiro@cliente.com.br'] });
    expect(sendMail).toHaveBeenCalledTimes(1);
    const mensagem = sendMail.mock.calls[0]![0] as { to: string[]; bcc: string; subject: string; attachments: { filename: string; content: Buffer }[] };
    expect(mensagem.to).toEqual(['financeiro@cliente.com.br']);
    expect(mensagem.bcc).toBe('dono@rodriguestech.com.br');
    expect(mensagem.subject).toContain('09/2026');
    expect(mensagem.attachments[0]?.filename).toBe('Boleto-Inter-setembro.pdf');
    expect(Buffer.compare(mensagem.attachments[0]!.content, pdf)).toBe(0);

    const pagamento = await request(app).post('/api/billing/pagamentos').set(auth(donoToken)).send({ data: '2026-10-05', referencia: '2026-09', valor: 300, forma: 'BOLETO', observacao: '', cobrancaId: cobranca.id });
    expect(pagamento.status).toBe(200);
    const paga = (pagamento.body.data.cobrancas as { id: string; pagoEm: string | null }[]).find((item) => item.id === cobranca.id);
    expect(paga?.pagoEm).toBe('2026-10-05');

    const remover = await request(app).delete(`/api/billing/cobrancas/${cobranca.id}`).set(auth(donoToken));
    expect(remover.status).toBe(200);
    expect(existsSync(resolve(process.cwd(), 'storage', 'cobrancas', `${cobranca.id}.pdf`))).toBe(false);
    expect((await request(app).get(`/api/billing/cobrancas/${cobranca.id}/arquivo`).set(auth(donoToken))).status).toBe(404);
  });

  it('não aceita boleto inexistente, quitado ou de outra referência no pagamento', async () => {
    const criar = await request(app).post('/api/billing/cobrancas').set(auth(donoToken)).field(campos).attach('arquivo', pdf, { filename: 'boleto.pdf', contentType: 'application/pdf' });
    expect(criar.status).toBe(201);
    const id = criar.body.data.id as string;
    const basePagamento = { data: '2026-10-05', referencia: '2026-09', valor: 300, forma: 'BOLETO', observacao: '' };
    const antes = await request(app).get('/api/billing').set(auth(donoToken));
    for (const dados of [
      { ...basePagamento, cobrancaId: randomUUID() },
      { ...basePagamento, cobrancaId: id, referencia: '2026-10' },
      { ...basePagamento, cobrancaId: id, valor: 0 },
    ]) {
      expect((await request(app).post('/api/billing/pagamentos').set(auth(donoToken)).send(dados)).status).toBe(400);
    }
    const depoisInvalidos = await request(app).get('/api/billing').set(auth(donoToken));
    expect(depoisInvalidos.body.data.vencimentoAtual).toBe(antes.body.data.vencimentoAtual);
    expect(depoisInvalidos.body.data.pagamentos).toEqual(antes.body.data.pagamentos);
    expect((await request(app).post('/api/billing/pagamentos').set(auth(donoToken)).send({ ...basePagamento, cobrancaId: id })).status).toBe(200);
    expect((await request(app).post('/api/billing/pagamentos').set(auth(donoToken)).send({ ...basePagamento, cobrancaId: id })).status).toBe(400);
    expect((await request(app).delete(`/api/billing/cobrancas/${id}`).set(auth(donoToken))).status).toBe(200);
  });

  it('dispara o lembrete automático uma vez só, e só com os lembretes ligados', async () => {
    const hoje = hojeIso();
    const [ano, mes, dia] = hoje.split('-').map(Number) as [number, number, number];
    const vencimento = new Date(Date.UTC(ano, mes - 1, dia + 2)).toISOString().slice(0, 10);
    const criar = await request(app).post('/api/billing/cobrancas').set(auth(donoToken)).field({ ...campos, referencia: '2035-01', vencimento }).attach('arquivo', pdf, { filename: 'b.pdf', contentType: 'application/pdf' });
    const id = criar.body.data.id as string;
    const config = {
      emails: ['financeiro@cliente.com.br'], copiaOculta: '',
      smtp: { host: 'smtp.teste.local', port: 587, seguranca: 'starttls', user: '', password: '', fromEmail: 'dono@teste.local', fromName: 'Teste' },
      lembretes: { ativo: false, diasAntes: 3, aposVencimento: true },
    };
    expect((await request(app).put('/api/billing/cobranca-config').set(auth(donoToken)).send(config)).status).toBe(200);
    sendMail.mockClear();
    expect(await executarLembretes()).toEqual({ enviados: 0, falhas: 0 });

    expect((await request(app).put('/api/billing/cobranca-config').set(auth(donoToken)).send({ ...config, lembretes: { ...config.lembretes, ativo: true } })).status).toBe(200);
    expect((await executarLembretes()).enviados).toBeGreaterThanOrEqual(1);
    const lembrete = sendMail.mock.calls.find((chamada) => (chamada[0] as { subject: string }).subject.includes(`vence em ${vencimento.split('-').reverse().join('/')}`));
    expect(lembrete).toBeDefined();
    const atual = await request(app).get('/api/billing').set(auth(donoToken));
    expect((atual.body.data.cobrancas as { id: string; lembretes: string[] }[]).find((item) => item.id === id)?.lembretes).toEqual(['ANTES']);

    sendMail.mockClear();
    await executarLembretes();
    expect(sendMail.mock.calls.some((chamada) => (chamada[0] as { subject: string }).subject.includes('2035'))).toBe(false);
    expect((await request(app).put('/api/billing/cobranca-config').set(auth(donoToken)).send(config)).status).toBe(200);
    expect((await request(app).delete(`/api/billing/cobrancas/${id}`).set(auth(donoToken))).status).toBe(200);
  });

  it('preserva pagamento feito enquanto o SMTP envia o boleto', async () => {
    const criar = await request(app).post('/api/billing/cobrancas').set(auth(donoToken)).field(campos).attach('arquivo', pdf, { filename: 'boleto.pdf', contentType: 'application/pdf' });
    expect(criar.status).toBe(201);
    const id = criar.body.data.id as string;
    const config = {
      emails: ['financeiro@cliente.com.br'], copiaOculta: '',
      smtp: { host: 'smtp.teste.local', port: 587, seguranca: 'starttls', user: '', password: '', fromEmail: 'dono@teste.local', fromName: 'Teste' },
    };
    expect((await request(app).put('/api/billing/cobranca-config').set(auth(donoToken)).send(config)).status).toBe(200);
    let avisarEnvio!: () => void;
    let liberarEnvio!: () => void;
    const iniciouEnvio = new Promise<void>((resolve) => { avisarEnvio = resolve; });
    const podeConcluirEnvio = new Promise<void>((resolve) => { liberarEnvio = resolve; });
    sendMail.mockImplementationOnce(async () => { avisarEnvio(); await podeConcluirEnvio; return { messageId: 'x' }; });
    const envio = request(app).post(`/api/billing/cobrancas/${id}/enviar`).set(auth(donoToken)).send({ para: ['financeiro@cliente.com.br'] }).then((res) => res);
    try {
      await iniciouEnvio;
      const pagamento = await request(app).post('/api/billing/pagamentos').set(auth(donoToken)).send({ data: '2026-10-05', referencia: '2026-09', valor: 300, forma: 'BOLETO', observacao: '', cobrancaId: id });
      expect(pagamento.status).toBe(200);
    } finally {
      liberarEnvio();
    }
    expect((await envio).status).toBe(200);
    const atual = await request(app).get('/api/billing').set(auth(donoToken));
    const boleto = (atual.body.data.cobrancas as { id: string; pagoEm: string | null; envios: number }[]).find((item) => item.id === id);
    expect(boleto).toMatchObject({ pagoEm: '2026-10-05', envios: 1 });
    expect((await request(app).delete(`/api/billing/cobrancas/${id}`).set(auth(donoToken))).status).toBe(200);
  });
});
