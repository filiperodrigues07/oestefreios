import { useEffect } from 'react';

/** Digitando num campo (ou com modificador), a tecla é do usuário — atalho nunca rouba letra de texto. */
function estaDigitando(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return true;
  const alvo = event.target as HTMLElement | null;
  if (!alvo) return false;
  return alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName);
}

/** Algum diálogo aberto: atalho de página não age por trás dele. */
function temDialogoAberto(): boolean {
  return document.querySelector('[role="dialog"][aria-modal="true"]') !== null;
}

export interface AppShortcuts {
  focarBusca?: () => void;
  novaOS?: () => void;
  mostrarAjuda?: () => void;
}

/** Atalhos de uma tecla no desktop: `/` busca, `N` nova OS, `?` lista de atalhos. */
export function useAppShortcuts({ focarBusca, novaOS, mostrarAjuda }: AppShortcuts): void {
  useEffect(() => {
    const aoTeclar = (event: KeyboardEvent) => {
      if (event.defaultPrevented || estaDigitando(event) || temDialogoAberto()) return;
      if (event.key === '/' && focarBusca) {
        event.preventDefault();
        focarBusca();
      } else if ((event.key === 'n' || event.key === 'N') && novaOS) {
        event.preventDefault();
        novaOS();
      } else if (event.key === '?' && mostrarAjuda) {
        event.preventDefault();
        mostrarAjuda();
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [focarBusca, novaOS, mostrarAjuda]);
}
