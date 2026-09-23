import { describe, expect, it } from 'vitest';
import { getClienteByDocumento } from './cliente.service.js';
import { documentoParamSchema } from '../validators/cliente.validator.js';

describe('consulta antecipada de cliente por documento', () => {
  it('encontra CPF no CHERP mock com ou sem máscara', async () => {
    expect((await getClienteByDocumento('12345678900'))?.codigo).toBe('000001');
    expect((await getClienteByDocumento('123.456.789-00'))?.codigo).toBe('000001');
  });

  it('encontra CNPJ com ou sem máscara e retorna null quando não existe', async () => {
    expect((await getClienteByDocumento('12345678000190'))?.codigo).toBe('000002');
    expect((await getClienteByDocumento('12.345.678/0001-90'))?.codigo).toBe('000002');
    expect(await getClienteByDocumento('00000000000')).toBeNull();
  });

  it('só aceita documentos com 11 ou 14 dígitos na rota', () => {
    expect(documentoParamSchema.parse({ documento: '123.456.789-00' }).documento).toBe('12345678900');
    expect(documentoParamSchema.parse({ documento: '12.345.678/0001-90' }).documento).toBe('12345678000190');
    expect(documentoParamSchema.safeParse({ documento: '123' }).success).toBe(false);
  });
});
