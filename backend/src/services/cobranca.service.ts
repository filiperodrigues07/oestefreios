import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AppError } from '../errors/AppError.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { ValidationError } from '../errors/ValidationError.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import { escaparHtml } from '../utils/html.js';
import { logger } from '../utils/logger.js';
import type { RequestContext } from '../utils/requestContext.js';
import { recordAudit } from './auditLog.service.js';
import { alterarBilling, getBilling, hojeIso, type BillingSettings } from './billing.service.js';
import {
  buildTransport,
  decryptSecret,
  encryptSecret,
  readCategory,
  SENHA_MASCARADA,
  writeCategory,
  type SmtpSettings,
} from './settings.service.js';

/**
 * Cobrança por boleto (Banco Inter): o proprietário cria a cobrança do mês (sozinha ou em lote), anexa o
 * PDF quando tiver, o sistema guarda o arquivo em `storage/cobrancas` (PRIVADO — fora do /api/uploads
 * público) e envia por e-mail a partir de um SMTP só do proprietário, com a lista de e-mails de cobrança
 * do cliente e o proprietário em cópia oculta.
 */

/** ANTES = alguns dias antes do vencimento; VENCIDA = depois que venceu sem baixa. */
export type TipoLembrete = 'ANTES' | 'VENCIDA';

export interface Cobranca {
  id: string;
  referencia: string;
  vencimento: string;
  valor: number;
  observacao: string;
  /** null enquanto o boleto ainda não foi anexado. */
  arquivoNome: string | null;
  arquivoTamanho: number | null;
  /** Opcionais: vão no corpo do e-mail para o cliente pagar sem abrir o PDF. */
  linhaDigitavel: string;
  pixCopiaCola: string;
  criadoEm: string;
  criadoPor: string;
  enviadoEm: string | null;
  enviadoPara: string[];
  envios: number;
  pagoEm: string | null;
  /** Lembretes automáticos já disparados para este boleto. */
  lembretes: TipoLembrete[];
}

export interface LembreteSettings {
  /** Desligado por padrão: e-mail automático ao cliente só quando o proprietário liga. */
  ativo: boolean;
  diasAntes: number;
  aposVencimento: boolean;
}

export interface CobrancaSettings {
  emails: string[];
  copiaOculta: string;
  smtp: SmtpSettings;
  lembretes: LembreteSettings;
}

const COBRANCA_PADRAO: CobrancaSettings = {
  emails: [],
  copiaOculta: '',
  smtp: { host: '', port: 587, seguranca: 'starttls', user: '', password: '', fromEmail: '', fromName: 'Rodrigues Tech' },
  lembretes: { ativo: false, diasAntes: 3, aposVencimento: true },
};

export const PDF_MAX_BYTES = 5 * 1024 * 1024;

function pastaCobrancas(): string {
  return resolve(process.cwd(), 'storage', 'cobrancas');
}

function caminhoDoArquivo(id: string): string {
  return resolve(pastaCobrancas(), `${id}.pdf`);
}

type ArquivoPdf = { buffer: Buffer; originalname: string };

function validarPdf(arquivo: ArquivoPdf): void {
  if (arquivo.buffer.length > PDF_MAX_BYTES) throw new ValidationError('O PDF do boleto pode ter no máximo 5 MB.');
  if (!ehPdf(arquivo.buffer)) throw new ValidationError('Anexe o boleto em PDF (o arquivo enviado não é um PDF válido).');
}

/** PDF de verdade começa com "%PDF-" — não confia em extensão nem Content-Type enviados pelo navegador. */
export function ehPdf(buffer: Buffer): boolean {
  return buffer.length > 8 && buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

export function nomeSeguro(nome: string): string {
  const base = nome.normalize('NFKD').replace(/[^\w.\- ]+/g, '').trim().replace(/\s+/g, '-').replace(/^\.+/, '').slice(0, 80);
  return base.toLowerCase().endsWith('.pdf') ? base : `${base || 'boleto'}.pdf`;
}

// ---------- configuração (e-mails + SMTP próprio) ----------

export async function getCobrancaSettings(): Promise<CobrancaSettings> {
  const salvo = await readCategory<Partial<CobrancaSettings>>('cobranca', {});
  const smtp = { ...COBRANCA_PADRAO.smtp, ...(salvo.smtp ?? {}) };
  return {
    emails: salvo.emails ?? [],
    copiaOculta: salvo.copiaOculta ?? '',
    smtp: { ...smtp, password: smtp.password ? decryptSecret(smtp.password) : '' },
    lembretes: { ...COBRANCA_PADRAO.lembretes, ...(salvo.lembretes ?? {}) },
  };
}

export async function getCobrancaSettingsMasked(): Promise<CobrancaSettings> {
  const config = await getCobrancaSettings();
  return { ...config, smtp: { ...config.smtp, password: config.smtp.password ? SENHA_MASCARADA : '' } };
}

export async function saveCobrancaSettings(input: CobrancaSettings, usuario: AuthenticatedUser, ctx: RequestContext): Promise<CobrancaSettings> {
  const atual = await getCobrancaSettings();
  const password = !input.smtp.password || input.smtp.password === SENHA_MASCARADA ? atual.smtp.password : input.smtp.password;
  await writeCategory('cobranca', { ...input, smtp: { ...input.smtp, password: encryptSecret(password) } });
  await recordAudit({
    userId: usuario.id,
    userName: usuario.name,
    event: 'BILLING_COBRANCA_CONFIG',
    entityType: 'BILLING',
    entityId: 'BILLING_COBRANCA_CONFIG',
    changes: { emails: input.emails, copiaOculta: input.copiaOculta, lembretes: input.lembretes, smtpHost: input.smtp.host, smtpUser: input.smtp.user, senhaAlterada: password !== atual.smtp.password },
    ...ctx,
  });
  return getCobrancaSettingsMasked();
}

function assertSmtp(config: CobrancaSettings): void {
  if (!config.smtp.host || !config.smtp.fromEmail) {
    throw new ValidationError('Configure o e-mail de cobrança (SMTP) antes de enviar.');
  }
}

export async function testarSmtpCobranca(destino: string): Promise<{ ok: boolean; message: string }> {
  const config = await getCobrancaSettings();
  try {
    assertSmtp(config);
    await comTimeout(buildTransport(config.smtp).sendMail({
      from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
      to: destino,
      subject: `${config.smtp.fromName} — teste do e-mail de cobrança`,
      html: '<p>Este é um teste do e-mail de cobrança. Se você recebeu, o envio de boletos está funcionando.</p>',
    }), 30_000);
    return { ok: true, message: 'E-mail de teste enviado.' };
  } catch (err) {
    logger.warn({ err }, 'Falha no teste do SMTP de cobrança');
    return { ok: false, message: err instanceof ValidationError ? err.message : 'Não foi possível enviar com essas configurações.' };
  }
}

// ---------- cobranças (boletos) ----------

function auditCobranca(event: string, usuario: AuthenticatedUser, ctx: RequestContext, changes: unknown) {
  return recordAudit({ userId: usuario.id, userName: usuario.name, event, entityType: 'BILLING', entityId: event, changes, ...ctx });
}

export interface NovaCobrancaInput {
  referencia: string;
  vencimento: string;
  valor: number;
  observacao: string;
  linhaDigitavel: string;
  pixCopiaCola: string;
}

const mesBr = (referencia: string) => referencia.split('-').reverse().join('/');

function assertReferenciaLivre(atual: BillingSettings, referencia: string, ignorarId?: string): void {
  if (atual.cobrancas.some((item) => item.referencia === referencia && item.id !== ignorarId)) {
    throw new ValidationError(`Já existe uma cobrança para ${mesBr(referencia)}. Edite a existente em vez de criar outra.`);
  }
}

function montarCobranca(input: NovaCobrancaInput, usuario: AuthenticatedUser, arquivo?: ArquivoPdf): Cobranca {
  return {
    id: randomUUID(),
    ...input,
    arquivoNome: arquivo ? nomeSeguro(arquivo.originalname) : null,
    arquivoTamanho: arquivo ? arquivo.buffer.length : null,
    criadoEm: new Date().toISOString(),
    criadoPor: usuario.name,
    enviadoEm: null,
    enviadoPara: [],
    envios: 0,
    pagoEm: null,
    lembretes: [],
  };
}

/** Cria a cobrança do mês. O PDF é opcional: dá para deixar a cobrança pronta e anexar o boleto depois. */
export async function criarCobranca(
  input: NovaCobrancaInput,
  arquivo: ArquivoPdf | undefined,
  usuario: AuthenticatedUser,
  ctx: RequestContext,
): Promise<Cobranca> {
  if (arquivo) validarPdf(arquivo);
  const cobranca = montarCobranca(input, usuario, arquivo);
  if (arquivo) {
    await mkdir(pastaCobrancas(), { recursive: true });
    await writeFile(caminhoDoArquivo(cobranca.id), arquivo.buffer);
  }
  try {
    await alterarBilling((atual) => {
      assertReferenciaLivre(atual, cobranca.referencia);
      return { ...atual, cobrancas: [cobranca, ...atual.cobrancas] };
    });
  } catch (err) {
    if (arquivo) await rm(caminhoDoArquivo(cobranca.id), { force: true });
    throw err;
  }
  await auditCobranca('BILLING_COBRANCA_CREATED', usuario, ctx, { cobranca });
  return cobranca;
}

/** Vencimento no dia configurado dentro do mês de referência (dia 31 em fevereiro cai no último dia). */
export function vencimentoDoMes(referencia: string, diaVencimento: number): string {
  const [ano, mes] = referencia.split('-').map(Number) as [number, number];
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${referencia}-${String(Math.min(diaVencimento, ultimoDia)).padStart(2, '0')}`;
}

export function referenciasSeguidas(inicio: string, meses: number): string[] {
  const [ano, mes] = inicio.split('-').map(Number) as [number, number];
  return Array.from({ length: meses }, (_, i) => {
    const total = ano * 12 + (mes - 1) + i;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
  });
}

export interface GerarCobrancasInput {
  inicio: string;
  meses: number;
}

/** Cria em lote as cobranças dos próximos meses (sem PDF), com o valor e o dia de vencimento da assinatura. */
export async function gerarCobrancas(
  input: GerarCobrancasInput,
  usuario: AuthenticatedUser,
  ctx: RequestContext,
): Promise<{ criadas: Cobranca[]; puladas: string[] }> {
  let criadas: Cobranca[] = [];
  let puladas: string[] = [];
  await alterarBilling((atual) => {
    if (atual.valorMensal <= 0) throw new ValidationError('Defina o valor mensal na aba Assinatura antes de gerar as cobranças.');
    const existentes = new Set(atual.cobrancas.map((item) => item.referencia));
    const referencias = referenciasSeguidas(input.inicio, input.meses);
    puladas = referencias.filter((ref) => existentes.has(ref));
    criadas = referencias
      .filter((ref) => !existentes.has(ref))
      .map((referencia) => montarCobranca({
        referencia,
        vencimento: vencimentoDoMes(referencia, atual.diaVencimento),
        valor: atual.valorMensal,
        observacao: '',
        linhaDigitavel: '',
        pixCopiaCola: '',
      }, usuario));
    return { ...atual, cobrancas: [...criadas, ...atual.cobrancas] };
  });
  if (criadas.length) {
    await auditCobranca('BILLING_COBRANCA_GENERATED', usuario, ctx, { referencias: criadas.map((item) => item.referencia), puladas });
  }
  return { criadas, puladas };
}

function acharCobranca(atual: BillingSettings, id: string): Cobranca {
  const cobranca = atual.cobrancas.find((item) => item.id === id);
  if (!cobranca) throw new NotFoundError('Cobrança não encontrada.', 'COBRANCA_NOT_FOUND');
  return cobranca;
}

function trocarCobranca(atual: BillingSettings, id: string, alterar: (cobranca: Cobranca) => Cobranca): BillingSettings {
  const cobranca = alterar(acharCobranca(atual, id));
  return { ...atual, cobrancas: atual.cobrancas.map((item) => (item.id === id ? cobranca : item)) };
}

export type AtualizarCobrancaInput = NovaCobrancaInput;

/** Corrige mês, vencimento, valor e dados de pagamento de um boleto ainda em aberto. */
export async function atualizarCobranca(id: string, input: AtualizarCobrancaInput, usuario: AuthenticatedUser, ctx: RequestContext): Promise<Cobranca> {
  const { antes, depois } = await alterarBilling((atual) => trocarCobranca(atual, id, (cobranca) => {
    if (cobranca.pagoEm) throw new ValidationError('Este boleto já está pago. Desfaça a baixa antes de editar.');
    assertReferenciaLivre(atual, input.referencia, id);
    // Vencimento novo = boleto novo: os lembretes daquele vencimento voltam a valer.
    const lembretes = input.vencimento === cobranca.vencimento ? cobranca.lembretes : [];
    return { ...cobranca, ...input, lembretes };
  }));
  const atualizada = acharCobranca(depois, id);
  await auditCobranca('BILLING_COBRANCA_UPDATED', usuario, ctx, { before: acharCobranca(antes, id), after: atualizada });
  return atualizada;
}

/** Anexa (ou troca) o PDF de uma cobrança já criada. */
export async function anexarArquivo(id: string, arquivo: ArquivoPdf, usuario: AuthenticatedUser, ctx: RequestContext): Promise<Cobranca> {
  validarPdf(arquivo);
  await mkdir(pastaCobrancas(), { recursive: true });
  const temporario = `${caminhoDoArquivo(id)}.${randomUUID()}.tmp`;
  await writeFile(temporario, arquivo.buffer);
  let resultado: { antes: BillingSettings; depois: BillingSettings };
  try {
    resultado = await alterarBilling((atual) => trocarCobranca(atual, id, (cobranca) => ({
      ...cobranca,
      arquivoNome: nomeSeguro(arquivo.originalname),
      arquivoTamanho: arquivo.buffer.length,
    })));
  } catch (err) {
    await rm(temporario, { force: true });
    throw err;
  }
  await rename(temporario, caminhoDoArquivo(id));
  const atualizada = acharCobranca(resultado.depois, id);
  const anterior = acharCobranca(resultado.antes, id);
  await auditCobranca('BILLING_COBRANCA_FILE', usuario, ctx, { cobrancaId: id, referencia: atualizada.referencia, arquivo: atualizada.arquivoNome, substituiu: anterior.arquivoNome });
  return atualizada;
}

export async function arquivoDaCobranca(id: string): Promise<{ nome: string; buffer: Buffer }> {
  const cobranca = acharCobranca(await getBilling(), id);
  if (!cobranca.arquivoNome) throw new NotFoundError('Esta cobrança ainda não tem boleto anexado.', 'COBRANCA_SEM_ARQUIVO');
  try {
    return { nome: cobranca.arquivoNome, buffer: await readFile(caminhoDoArquivo(id)) };
  } catch {
    throw new NotFoundError('O arquivo desta cobrança não foi encontrado no servidor.', 'COBRANCA_FILE_MISSING');
  }
}

export async function removerCobranca(id: string, usuario: AuthenticatedUser, ctx: RequestContext): Promise<void> {
  const { antes } = await alterarBilling((atual) => {
    acharCobranca(atual, id);
    return { ...atual, cobrancas: atual.cobrancas.filter((item) => item.id !== id) };
  });
  const cobranca = acharCobranca(antes, id);
  await rm(caminhoDoArquivo(id), { force: true });
  await auditCobranca('BILLING_COBRANCA_REMOVED', usuario, ctx, { cobranca });
}

/** Teto de tempo para o envio: SMTP errado/travado não deixa a tela esperando indefinidamente. */
function comTimeout<T>(promessa: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const limite = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new Error('Tempo esgotado ao enviar o e-mail.')), ms);
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(timer));
}

const escapar = escaparHtml;
const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (iso: string) => iso.split('-').reverse().join('/');

export type TipoEmailCobranca = 'BOLETO' | TipoLembrete;

type DadosEmail = Pick<Cobranca, 'referencia' | 'vencimento' | 'valor'> & Partial<Pick<Cobranca, 'linhaDigitavel' | 'pixCopiaCola'>>;

export function montarEmailBoleto(cobranca: DadosEmail, remetente: string, mensagem: string, tipo: TipoEmailCobranca = 'BOLETO'): { assunto: string; html: string } {
  const referencia = mesBr(cobranca.referencia);
  const vencimento = dataBr(cobranca.vencimento);
  const extra = mensagem.trim() ? `<p>${escapar(mensagem.trim()).replace(/\n/g, '<br>')}</p>` : '';
  const textos: Record<TipoEmailCobranca, { assunto: string; abertura: string; fecho: string }> = {
    BOLETO: {
      assunto: `${remetente} — boleto de ${referencia} (vencimento ${vencimento})`,
      abertura: `Segue em anexo o boleto referente a <strong>${referencia}</strong>.`,
      fecho: '',
    },
    ANTES: {
      assunto: `${remetente} — lembrete: boleto de ${referencia} vence em ${vencimento}`,
      abertura: `Passando para lembrar que o boleto referente a <strong>${referencia}</strong> vence em <strong>${vencimento}</strong>. Ele segue novamente em anexo.`,
      fecho: '<p>Se o pagamento já foi feito, pode desconsiderar este aviso.</p>',
    },
    VENCIDA: {
      assunto: `${remetente} — boleto de ${referencia} em aberto (venceu em ${vencimento})`,
      abertura: `Ainda não identificamos o pagamento do boleto referente a <strong>${referencia}</strong>, que venceu em <strong>${vencimento}</strong>. Ele segue em anexo.`,
      fecho: '<p>Se o pagamento já foi feito, pode desconsiderar este aviso.</p>',
    },
  };
  const { assunto, abertura, fecho } = textos[tipo];
  const linha = (rotulo: string, valor: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;vertical-align:top">${rotulo}</td><td>${valor}</td></tr>`;
  const codigo = (valor: string) => `<code style="font-family:Consolas,monospace;font-size:13px;word-break:break-all">${escapar(valor)}</code>`;
  const linhas = [
    linha('Valor', `<strong>${moeda(cobranca.valor)}</strong>`),
    linha('Vencimento', `<strong>${vencimento}</strong>`),
    cobranca.linhaDigitavel?.trim() ? linha('Linha digitável', codigo(cobranca.linhaDigitavel.trim())) : '',
    cobranca.pixCopiaCola?.trim() ? linha('PIX copia e cola', codigo(cobranca.pixCopiaCola.trim())) : '',
  ].join('\n');
  return {
    assunto,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1f2937">
<p>Olá,</p>
<p>${abertura}</p>
<table style="border-collapse:collapse;margin:12px 0">${linhas}</table>
${extra}${fecho}<p>Em caso de dúvida, é só responder este e-mail.</p><p>${escapar(remetente)}</p></div>`,
  };
}

export interface EnviarCobrancaInput {
  para?: string[];
  mensagem?: string;
}

async function dispararEmail(
  cobranca: Cobranca,
  config: CobrancaSettings,
  destinatarios: string[],
  mensagem: string,
  tipo: TipoEmailCobranca,
): Promise<void> {
  const { buffer, nome } = await arquivoDaCobranca(cobranca.id);
  const { assunto, html } = montarEmailBoleto(cobranca, config.smtp.fromName, mensagem, tipo);
  try {
    await comTimeout(buildTransport(config.smtp).sendMail({
      from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
      to: destinatarios,
      bcc: config.copiaOculta || undefined,
      subject: assunto,
      html,
      attachments: [{ filename: nome, content: buffer, contentType: 'application/pdf' }],
    }), 45_000);
  } catch (err) {
    logger.warn({ err, tipo }, 'Falha ao enviar boleto por e-mail');
    throw new AppError('COBRANCA_EMAIL_FAILED', 'Não foi possível enviar o e-mail. Confira o SMTP de cobrança e tente de novo.', 502);
  }
}

export async function enviarCobranca(id: string, input: EnviarCobrancaInput, usuario: AuthenticatedUser, ctx: RequestContext): Promise<Cobranca> {
  const atual = await getBilling();
  const cobranca = acharCobranca(atual, id);
  if (!cobranca.arquivoNome) throw new ValidationError('Anexe o boleto em PDF antes de enviar.');
  const config = await getCobrancaSettings();
  assertSmtp(config);
  const destinatarios = input.para?.length ? input.para : config.emails;
  if (destinatarios.length === 0) throw new ValidationError('Cadastre ao menos um e-mail de cobrança do cliente antes de enviar.');
  await dispararEmail(cobranca, config, destinatarios, input.mensagem ?? '', 'BOLETO');

  const { depois } = await alterarBilling((recente) => trocarCobranca(recente, id, (existente) => ({
    ...existente,
    enviadoEm: new Date().toISOString(),
    enviadoPara: destinatarios,
    envios: existente.envios + 1,
  })));
  const atualizada = acharCobranca(depois, id);
  await auditCobranca('BILLING_COBRANCA_SENT', usuario, ctx, { cobrancaId: id, referencia: cobranca.referencia, para: destinatarios, bcc: Boolean(config.copiaOculta) });
  return atualizada;
}

// ---------- lembretes automáticos ----------

function diasAte(vencimento: string, hoje: string): number {
  const utc = (iso: string) => {
    const [ano, mes, dia] = iso.split('-').map(Number) as [number, number, number];
    return Date.UTC(ano, mes - 1, dia);
  };
  return Math.round((utc(vencimento) - utc(hoje)) / 86_400_000);
}

/** Até quantos dias depois do vencimento ainda vale mandar o aviso de boleto vencido. */
const JANELA_VENCIDA_DIAS = 15;

/** Função pura: qual lembrete este boleto deve receber hoje (ou nenhum). */
export function lembreteDevido(cobranca: Cobranca, hoje: string, regras: LembreteSettings): TipoLembrete | null {
  if (cobranca.pagoEm || !cobranca.arquivoNome) return null;
  const dias = diasAte(cobranca.vencimento, hoje);
  if (dias >= 0 && dias <= regras.diasAntes && !cobranca.lembretes.includes('ANTES')) {
    // Se o proprietário já mandou o boleto dentro da janela do lembrete, não repete.
    const enviadoNaJanela = cobranca.enviadoEm && diasAte(cobranca.vencimento, hojeIso(new Date(cobranca.enviadoEm))) <= regras.diasAntes;
    return enviadoNaJanela ? null : 'ANTES';
  }
  if (regras.aposVencimento && dias < 0 && dias >= -JANELA_VENCIDA_DIAS && !cobranca.lembretes.includes('VENCIDA')) return 'VENCIDA';
  return null;
}

/** Roda a fila de lembretes: um e-mail por boleto devido, marcando o lembrete para não repetir. */
export async function executarLembretes(agora = new Date()): Promise<{ enviados: number; falhas: number }> {
  const config = await getCobrancaSettings();
  if (!config.lembretes.ativo || !config.smtp.host || !config.smtp.fromEmail || config.emails.length === 0) {
    return { enviados: 0, falhas: 0 };
  }
  const hoje = hojeIso(agora);
  const billing = await getBilling();
  let enviados = 0;
  let falhas = 0;
  for (const cobranca of billing.cobrancas) {
    const tipo = lembreteDevido(cobranca, hoje, config.lembretes);
    if (!tipo) continue;
    try {
      await dispararEmail(cobranca, config, config.emails, '', tipo);
    } catch (err) {
      falhas += 1;
      logger.warn({ err, cobrancaId: cobranca.id, tipo }, 'Lembrete de cobrança não enviado');
      continue;
    }
    await alterarBilling((recente) => trocarCobranca(recente, cobranca.id, (existente) => ({
      ...existente,
      lembretes: [...existente.lembretes, tipo],
    })));
    await recordAudit({
      userId: null,
      userName: 'Sistema',
      event: 'BILLING_COBRANCA_REMINDER',
      entityType: 'BILLING',
      entityId: 'BILLING_COBRANCA_REMINDER',
      changes: { cobrancaId: cobranca.id, referencia: cobranca.referencia, tipo, para: config.emails },
    });
    enviados += 1;
  }
  return { enviados, falhas };
}

const LEMBRETE_INTERVALO_MS = 6 * 60 * 60 * 1000;

/** Confere os lembretes 2 min após subir e depois a cada 6 h. O timer não segura o processo no shutdown. */
export function agendarLembretesCobranca(): () => void {
  let rodando = false;
  const rodar = () => {
    if (rodando) return;
    rodando = true;
    executarLembretes()
      .then((r) => { if (r.enviados || r.falhas) logger.info(r, 'Lembretes de cobrança processados'); })
      .catch((err) => logger.error({ err }, 'Falha ao processar lembretes de cobrança'))
      .finally(() => { rodando = false; });
  };
  const inicial = setTimeout(rodar, 120_000);
  const periodico = setInterval(rodar, LEMBRETE_INTERVALO_MS);
  inicial.unref();
  periodico.unref();
  return () => {
    clearTimeout(inicial);
    clearInterval(periodico);
  };
}
