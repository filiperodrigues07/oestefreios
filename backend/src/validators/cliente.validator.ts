import { z } from 'zod';
import { toUppercase } from './textTransform.js';

/** O CHERP guarda CEP como "NNNNN-NNN"; CEP só com dígitos (ex.: vindo da consulta de CNPJ) aparece truncado lá. */
export function normalizarCep(valor: string): string {
  const digitos = valor.replace(/\D/g, '');
  return digitos.length === 8 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : valor;
}

// Base compartilhada; criação e edição usam clienteCreateSchema para exigir os mesmos campos.
export const clienteInputSchema = z.object({
  ativo: z.boolean().default(true),
  tipoPessoa: z.enum(['PF', 'PJ']),
  nome: z.string().trim().min(1, 'Nome é obrigatório.').transform(toUppercase),
  nomeFantasia: z.string().trim().transform(toUppercase).optional(),
  documento: z.string().trim().min(1, 'CPF/CNPJ é obrigatório.'),
  telefone: z.string().trim().optional(),
  celular: z.string().trim().optional(),
  email: z.email().optional().or(z.literal('')),
  emailFinanceiro: z.email().optional().or(z.literal('')),
  emailNfe: z.email().optional().or(z.literal('')),
  homePage: z.url().optional().or(z.literal('')),
  inscricaoEstadual: z.string().trim().transform(toUppercase).optional(),
  inscricaoMunicipal: z.string().trim().transform(toUppercase).optional(),
  reducaoMva: z.number().min(0).optional(),
  coreRepresentante: z.string().trim().transform(toUppercase).optional(),
  endereco: z.string().trim().transform(toUppercase).optional(),
  numero: z.string().trim().transform(toUppercase).optional(),
  bairro: z.string().trim().transform(toUppercase).optional(),
  complemento: z.string().trim().transform(toUppercase).optional(),
  cidade: z.string().trim().transform(toUppercase).optional(),
  uf: z.string().trim().length(2, 'UF inválida.').transform(toUppercase).optional(),
  cep: z.string().trim().transform(normalizarCep).optional(),
  fornecedor: z.boolean().default(false),
  transportador: z.boolean().default(false),
  representante: z.boolean().default(false),
  regimeTributario: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
});

/**
 * Criação e edição — exige os campos definidos com o usuário pra parear com o CHERP.
 * `inscricaoEstadual` é a mesma coluna do CHERP (IERG) usada tanto pra Inscrição Estadual (PJ)
 * quanto pra Identidade/RG (PF) — só o rótulo muda lá, o campo é o mesmo. Nome Fantasia e esse
 * campo só são obrigatórios pra pessoa jurídica; pessoa física pode cadastrar sem.
 */
export const clienteCreateSchema = clienteInputSchema
  .extend({
    celular: z.string().trim().min(1, 'Celular/WhatsApp é obrigatório.'),
    endereco: z.string().trim().min(1, 'Endereço é obrigatório.').transform(toUppercase),
    numero: z.string().trim().min(1, 'Número é obrigatório.').transform(toUppercase),
    bairro: z.string().trim().min(1, 'Bairro é obrigatório.').transform(toUppercase),
    cidade: z.string().trim().min(1, 'Cidade é obrigatória.').transform(toUppercase),
    uf: z.string().trim().length(2, 'UF inválida.').transform(toUppercase),
    cep: z.string().trim().min(1, 'CEP é obrigatório.').transform(normalizarCep),
  })
  .superRefine((data, ctx) => {
    if (data.tipoPessoa === 'PF' && !cpfValido(data.documento)) {
      ctx.addIssue({ code: 'custom', message: 'CPF inválido.', path: ['documento'] });
    }
    if (data.tipoPessoa !== 'PJ') return;
    if (data.regimeTributario === undefined) {
      ctx.addIssue({ code: 'custom', message: 'Regime tributário é obrigatório para pessoa jurídica.', path: ['regimeTributario'] });
    }
    if (!data.nomeFantasia?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Nome fantasia é obrigatório para pessoa jurídica.', path: ['nomeFantasia'] });
    }
    if (!data.inscricaoEstadual?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Inscrição estadual é obrigatória para pessoa jurídica.', path: ['inscricaoEstadual'] });
    }
  });

function cpfValido(documento: string): boolean {
  const digits = documento.replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  for (const position of [9, 10]) {
    const total = digits.slice(0, position).split('').reduce((sum, digit, index) => sum + Number(digit) * (position + 1 - index), 0);
    const check = (total * 10) % 11 % 10;
    if (check !== Number(digits[position])) return false;
  }
  return true;
}

export const cnpjParamSchema = z.object({
  cnpj: z
    .string()
    .trim()
    .transform((s) => s.replace(/\D/g, ''))
    .refine((s) => s.length === 14, 'CNPJ precisa ter 14 dígitos.'),
});

export const documentoParamSchema = z.object({
  documento: z.string().trim().transform((s) => s.replace(/\D/g, '')).refine((s) => s.length === 11 || s.length === 14, 'CPF/CNPJ inválido.'),
});

export const cepParamSchema = z.object({
  cep: z.string().trim().transform((s) => s.replace(/\D/g, '')).refine((s) => s.length === 8, 'CEP precisa ter 8 dígitos.'),
});
