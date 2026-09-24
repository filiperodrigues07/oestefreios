import { z } from 'zod';

/** Motivo fica como digitado (sem `toUppercase`) — é texto de auditoria, não dado do CHERP. */
export const excluirCadastroSchema = z.object({
  motivo: z.string().trim().min(5, 'Informe o motivo da exclusão (mínimo 5 caracteres).').max(500),
});
