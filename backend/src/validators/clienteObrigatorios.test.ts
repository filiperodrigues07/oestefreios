import { describe, expect, it } from 'vitest';
import { clienteCreateSchema } from './cliente.validator.js';

const pessoaFisica = {
  tipoPessoa: 'PF' as const,
  nome: 'Cliente Teste',
  documento: '529.982.247-25',
  celular: '(11) 99999-9999',
  cep: '01001-000',
  endereco: 'Rua Teste',
  numero: '10',
  bairro: 'Centro',
  cidade: 'São Paulo',
  uf: 'SP',
};

describe('campos obrigatórios de cliente', () => {
  it('aceita PF completa sem campos exclusivos de PJ', () => {
    expect(clienteCreateSchema.safeParse(pessoaFisica).success).toBe(true);
  });

  it.each(['celular', 'cep', 'endereco', 'numero', 'bairro', 'cidade', 'uf'] as const)(
    'exige %s tanto na criação quanto na edição', (campo) => {
      const resultado = clienteCreateSchema.safeParse({ ...pessoaFisica, [campo]: '' });
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues.some((issue) => issue.path[0] === campo)).toBe(true);
      }
    },
  );

  it.each(['529.982.247-26', '111.111.111-11', '123'])('recusa CPF inválido: %s', (documento) => {
    const resultado = clienteCreateSchema.safeParse({ ...pessoaFisica, documento });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues.some((issue) => issue.path[0] === 'documento')).toBe(true);
    }
  });

  it('mantém as exigências exclusivas da PJ', () => {
    const resultado = clienteCreateSchema.safeParse({ ...pessoaFisica, tipoPessoa: 'PJ', documento: '12345678000190' });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(['nomeFantasia', 'inscricaoEstadual', 'regimeTributario']),
      );
    }
  });
});
