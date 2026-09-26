import { describe, expect, it } from 'vitest';
import { getErrorPresentation, getUserErrorMessage } from './errorPresentation.js';

describe('Mensagens de erro', () => {
  it.each([400, 401, 403, 404, 408, 409, 410, 413, 422, 429, 500, 502, 503, 504])(
    'apresenta o status %s sem expor dados técnicos',
    (status) => {
      const result = getErrorPresentation({
        status,
        message: 'SELECT senha FROM usuarios; stack trace privado',
      });
      expect(result.code).toBe(String(status));
      expect(result.title.length).toBeGreaterThan(0);
      expect(JSON.stringify(result)).not.toMatch(/SELECT|senha|stack trace/);
    },
  );

  it('separa falha de módulo, conexão e erro desconhecido', () => {
    expect(
      getErrorPresentation(
        new Error('Failed to fetch dynamically imported module: /assets/antigo.js'),
      ).code,
    ).toBe('ATUALIZAÇÃO');
    expect(getErrorPresentation(new TypeError('Failed to fetch')).code).toBe('CONEXÃO');
    expect(getErrorPresentation(undefined, true).title).toBe('Você está sem conexão');
    expect(getErrorPresentation(new Error('detalhe interno')).code).toBe('OPS!');
  });

  it('prioriza o status recebido e trata status desconhecidos', () => {
    expect(getErrorPresentation({ status: 404 }, true).code).toBe('404');
    expect(getErrorPresentation({ status: 503, code: 'NETWORK_ERROR' }).code).toBe('503');
    expect(getErrorPresentation({ status: 599 }).title).toBe(
      getErrorPresentation({ status: 500 }).title,
    );
    expect(getErrorPresentation({ status: 418 }).title).toBe(
      getErrorPresentation({ status: 400 }).title,
    );
  });

  it('oferece a recuperação apropriada', () => {
    expect(getErrorPresentation({ status: 401 }).recovery).toBe('login');
    expect(getErrorPresentation({ status: 403 }).recovery).toBe('home');
    expect(getErrorPresentation({ status: 404 }).recovery).toBe('home');
    expect(getErrorPresentation({ status: 503 }).recovery).toBe('retry');
  });
});

describe('Mensagens curtas para ações', () => {
  it('não expõe erros técnicos e mantém orientação para conexão e validação', () => {
    const fallback = 'Não foi possível salvar. Tente novamente.';
    expect(getUserErrorMessage(new TypeError('crypto.randomUUID is not a function'), fallback)).toBe(fallback);
    expect(getUserErrorMessage({ status: 500, message: 'SELECT senha FROM usuarios' }, fallback)).not.toMatch(/SELECT|senha/);
    expect(getUserErrorMessage({ status: 422, message: 'SQL error' }, fallback)).toContain('Confira');
    expect(getUserErrorMessage({ code: 'NETWORK_ERROR' }, fallback)).toContain('conexão');
    expect(getUserErrorMessage(new TypeError('Failed to fetch'), fallback)).toContain('conexão');
    expect(getUserErrorMessage({ status: 400, code: 'VALIDATION_ERROR', message: 'Produto já adicionado a esta OS.' }, fallback))
      .toBe('Produto já adicionado a esta OS.');
  });
});
