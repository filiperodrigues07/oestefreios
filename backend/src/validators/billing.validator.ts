import { z } from 'zod';

const dataIso = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.')
  .refine((value) => {
    const data = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === value;
  }, 'Informe uma data válida.');
const mesIso = z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use um mês válido em AAAA-MM.');

export const billingUpdateSchema = z.object({
  cliente: z.string().trim().max(120),
  plano: z.string().trim().max(80),
  valorMensal: z.coerce.number().min(0).max(1_000_000),
  vencimentoAtual: dataIso.nullable(),
  diaVencimento: z.coerce.number().int().min(1).max(31),
  carenciaDias: z.coerce.number().int().min(0).max(60),
  avisoDias: z.coerce.number().int().min(0).max(60),
  observacaoInterna: z.string().trim().max(500).default(''),
  mensagemCliente: z.string().trim().max(300).default(''),
});

export const controleAssinaturaSchema = z.object({
  acao: z.enum(['SUSPENDER', 'LIBERAR', 'AUTOMATICO']),
  motivo: z.string().trim().min(5, 'Informe o motivo (mínimo 5 caracteres).').max(500),
  liberadoAte: dataIso.nullable().optional(),
  mensagemCliente: z.string().trim().max(300).optional(),
});

export const licencaConfigSchema = z.object({
  limite: z.coerce.number().int().min(0).max(500),
  idleMinutes: z.coerce.number().int().min(1).max(240),
  sessaoUnica: z.boolean(),
});

export const novoPagamentoSchema = z.object({
  data: dataIso,
  referencia: mesIso,
  valor: z.coerce.number().min(0).max(1_000_000),
  forma: z.enum(['PIX', 'BOLETO', 'DINHEIRO', 'OUTRO']),
  observacao: z.string().trim().max(300).default(''),
  cobrancaId: z.string().uuid().optional(),
});

export const novaCobrancaSchema = z.object({
  referencia: mesIso,
  vencimento: dataIso,
  valor: z.coerce.number().min(0).max(1_000_000),
  observacao: z.string().trim().max(300).default(''),
  // Linha digitável do boleto: 47/48 dígitos, aceita com pontos e espaços como vem do banco.
  linhaDigitavel: z.string().trim().max(80).regex(/^[\d.\s-]*$/, 'A linha digitável só tem números.').default(''),
  pixCopiaCola: z.string().trim().max(600).default(''),
});

export const atualizarCobrancaSchema = novaCobrancaSchema;

export const gerarCobrancasSchema = z.object({
  inicio: mesIso,
  meses: z.coerce.number().int().min(1).max(12),
});

export const enviarCobrancaSchema = z.object({
  para: z.array(z.email()).max(10).optional(),
  mensagem: z.string().trim().max(1000).optional(),
});

export const cobrancaConfigSchema = z.object({
  emails: z.array(z.email()).max(10),
  copiaOculta: z.email().or(z.literal('')),
  smtp: z.object({
    host: z.string().trim().max(200),
    port: z.coerce.number().int().positive(),
    seguranca: z.enum(['nenhuma', 'starttls', 'ssl']),
    user: z.string().trim().max(200),
    password: z.string().max(500),
    fromEmail: z.string().trim().max(200),
    fromName: z.string().trim().min(1).max(100),
  }),
  lembretes: z.object({
    ativo: z.boolean(),
    diasAntes: z.coerce.number().int().min(0).max(15),
    aposVencimento: z.boolean(),
  }).default({ ativo: false, diasAntes: 3, aposVencimento: true }),
});

export const testeCobrancaSchema = z.object({ destino: z.email() });
