import { z } from 'zod';
import { toUppercase } from './textTransform.js';

// Base compartilhada por criação e edição — CHERP em si não trava nada disso no banco (só PESSOA
// é NOT NULL na tabela CLIFOR), então aqui só Nome e Documento são obrigatórios sempre. Os demais
// campos "pareados com o CHERP" (ver clienteCreateSchema) só viram obrigatórios na criação: 137
// dos 368 clientes ativos hoje já existem sem um ou mais desses campos preenchidos (Celular e
// Inscrição Estadual são os mais comuns de faltar) — travar a edição deles até completar os dados
// deixaria gente presa numa alteração boba, tipo corrigir um telefone.
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
  cep: z.string().trim().optional(),
  fornecedor: z.boolean().default(false),
  transportador: z.boolean().default(false),
  representante: z.boolean().default(false),
  regimeTributario: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
});

/**
 * Só pra criação (POST) — exige os campos definidos com o usuário pra parear com o CHERP.
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
    cep: z.string().trim().min(1, 'CEP é obrigatório.'),
  })
  .superRefine((data, ctx) => {
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
