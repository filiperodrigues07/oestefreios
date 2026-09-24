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
import { ehPdf, montarEmailBoleto, nomeSeguro } from '../services/cobranca.service.js';
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

  it('recusa arquivo que não é PDF e exige o anexo', async () => {
    const falso = await request(app).post('/api/billing/cobrancas').set(auth(donoToken)).field(campos).attach('arquivo', Buffer.from('<html>nao sou pdf, so finjo</html>'), { filename: 'boleto.pdf', contentType: 'application/pdf' });
    expect(falso.status).toBe(400);
    const semArquivo = await request(app).post('/api/billing/cobrancas').set(auth(donoToken)).field(campos);
    expect(semArquivo.status).toBe(400);
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
    const revelada = await request(app).get('/api/billing/cobranca-config/senha').set(auth(donoToken));
    expect(revelada.body.data.password).toBe('segredo-super');

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
