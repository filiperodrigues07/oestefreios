import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./auditLog.service.js', () => ({ recordAudit: vi.fn(async () => undefined) }));
import { atualizarCliente, criarCliente, getClienteByDocumento } from './cliente.service.js';
import { ClienteRepositoryMock } from '../repositories/mock/ClienteRepository.mock.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
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
const usuario: AuthenticatedUser = {
  id: 'u1',
  email: 'admin@teste.local',
  name: 'Admin Teste',
  roleId: 'r1',
  roleName: 'Administrador',
  permissions: ['OS_CREATE', 'OS_EDIT'],
  mustChangePassword: false,
};

afterEach(() => vi.restoreAllMocks());

describe('duplicidade de CPF/CNPJ', () => {
  it('impede novo cliente com documento ja cadastrado', async () => {
    const criar = vi.spyOn(ClienteRepositoryMock.prototype, 'criar').mockRejectedValue(new Error('gravacao indevida'));
    await expect(criarCliente({ tipoPessoa: 'PF', nome: 'Teste', documento: '12345678900' }, usuario))
      .rejects.toMatchObject({ code: 'CLIENT_DUPLICATE' });
    expect(criar).not.toHaveBeenCalled();
  });

  it('permite editar outros campos sem trocar um documento ja existente', async () => {
    const existente = await new ClienteRepositoryMock().buscarPorCodigo('000003');
    const outro = await new ClienteRepositoryMock().buscarPorCodigo('000001');
    if (!existente || !outro) throw new Error('Clientes de teste ausentes');
    const buscarDocumento = vi.spyOn(ClienteRepositoryMock.prototype, 'buscarPorDocumento').mockResolvedValue(outro);
    const atualizar = vi.spyOn(ClienteRepositoryMock.prototype, 'atualizar').mockResolvedValue(existente);

    await expect(atualizarCliente('000003', {
      tipoPessoa: 'PF', nome: 'Nome atualizado', documento: '98765432100',
    }, usuario)).resolves.toMatchObject({ codigo: '000003' });
    expect(buscarDocumento).not.toHaveBeenCalled();
    expect(atualizar).toHaveBeenCalledOnce();
  });
  it('impede editar um cliente para usar documento de outro', async () => {
    const atualizar = vi.spyOn(ClienteRepositoryMock.prototype, 'atualizar').mockRejectedValue(new Error('gravacao indevida'));
    await expect(atualizarCliente('000003', { tipoPessoa: 'PF', nome: 'Teste', documento: '12345678900' }, usuario))
      .rejects.toMatchObject({ code: 'CLIENT_DUPLICATE', details: { codigo: '000001' } });
    expect(atualizar).not.toHaveBeenCalled();
  });
});
