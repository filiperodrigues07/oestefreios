import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ErrorScreen } from './ErrorScreen.js';
import { ErrorState } from './ErrorState.js';
import { RouteErrorPage } from '../../routes/RouteErrorPage.js';

describe('Telas de erro', () => {
  it('renderiza sem providers e oferece login no 401', () => {
    const html = renderToStaticMarkup(createElement(ErrorScreen, { error: { status: 401 } }));
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/"');
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('Recarregar página');
  });

  it('preserva a ação local de tentar novamente', () => {
    const html = renderToStaticMarkup(
      createElement(ErrorState, {
        error: { status: 503 },
        action: createElement('button', null, 'Consultar novamente'),
      }),
    );
    expect(html).toContain('Serviço temporariamente indisponível');
    expect(html).toContain('Consultar novamente');
    expect(html).not.toContain('<main');
    expect(html).not.toContain('Recarregar página');
  });

  it('substitui a tela padrão do roteador em um endereço inexistente', () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: createElement('div', null, 'Início'),
          errorElement: createElement(RouteErrorPage),
        },
      ],
      { initialEntries: ['/endereco-inexistente'] },
    );
    const html = renderToStaticMarkup(createElement(RouterProvider, { router }));
    expect(html).toContain('404');
    expect(html).toContain('Não encontramos este conteúdo');
    expect(html).not.toContain('Unexpected Application Error');
    router.dispose();
  });
});
