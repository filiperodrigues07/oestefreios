const PREFIX = 'filtros:';

/**
 * Filtros de listagem persistem na URL (compartilhável, funciona com voltar do navegador) e,
 * espelhados aqui, também em sessionStorage — a navegação pelo menu lateral troca de rota sem
 * query string nenhuma, então sem isso o filtro se perderia ao sair da tela e voltar por ali.
 */
export function readStoredFilters(pageKey: string): URLSearchParams {
  try {
    const raw = sessionStorage.getItem(PREFIX + pageKey);
    return new URLSearchParams(raw ?? '');
  } catch {
    return new URLSearchParams();
  }
}

export function writeStoredFilters(pageKey: string, params: URLSearchParams): void {
  try {
    sessionStorage.setItem(PREFIX + pageKey, params.toString());
  } catch {
    // sessionStorage indisponível (modo privado, quota cheia) — filtro ainda funciona via URL.
  }
}
