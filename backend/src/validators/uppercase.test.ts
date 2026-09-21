import { describe, expect, it } from 'vitest';
import { clienteInputSchema } from './cliente.validator.js';
import { equipamentoInputSchema } from './equipamento.validator.js';
import {
  adicionarProdutoSchema,
  atualizarOSSchema,
  criarOSSchema,
} from './os.validator.js';

describe('normalização em maiúsculas para o CHERP', () => {
  it('normaliza os textos do cliente sem alterar e-mail e site', () => {
    const result = clienteInputSchema.parse({
      tipoPessoa: 'PJ',
      nome: 'Mecânica São José',
      nomeFantasia: 'oficina do josé',
      documento: '123',
      endereco: 'rua das araucárias',
      numero: '12 a',
      cidade: 'são paulo',
      uf: 'sp',
      email: 'Contato@Empresa.com',
      homePage: 'https://Empresa.com/Contato',
    });

    expect(result).toMatchObject({
      nome: 'MECÂNICA SÃO JOSÉ',
      nomeFantasia: 'OFICINA DO JOSÉ',
      endereco: 'RUA DAS ARAUCÁRIAS',
      numero: '12 A',
      cidade: 'SÃO PAULO',
      uf: 'SP',
      email: 'Contato@Empresa.com',
      homePage: 'https://Empresa.com/Contato',
    });
  });

  it('normaliza placa e dados textuais do veículo', () => {
    const result = equipamentoInputSchema.parse({
      clienteCodigo: '1',
      placa: 'abc1d23',
      marca: 'mercedes-benz',
      modelo: 'atego',
      cor: 'cinza',
      chassi: 'abc123x',
    });

    expect(result).toMatchObject({
      placa: 'ABC1D23',
      marca: 'MERCEDES-BENZ',
      modelo: 'ATEGO',
      cor: 'CINZA',
      chassi: 'ABC123X',
    });
  });

  it('normaliza os textos e complementos da OS', () => {
    expect(criarOSSchema.parse({ clienteCodigo: '1', equipamentoCodigo: '2', problema: 'ruído no freio' }).problema)
      .toBe('RUÍDO NO FREIO');

    expect(atualizarOSSchema.parse({ diagnostico: 'pastilha gasta', observacoes: 'lado esquerdo', solucao: 'troca realizada' }))
      .toMatchObject({ diagnostico: 'PASTILHA GASTA', observacoes: 'LADO ESQUERDO', solucao: 'TROCA REALIZADA' });

    expect(adicionarProdutoSchema.parse({ produtoCodigo: '10', descricaoComplementar: 'usar peça reforçada' }).descricaoComplementar)
      .toBe('USAR PEÇA REFORÇADA');
  });
});
