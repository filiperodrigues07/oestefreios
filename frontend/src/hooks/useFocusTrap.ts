import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Prende o foco dentro do container enquanto `active`, devolve o foco ao elemento
 * anterior ao fechar, e chama `onEscape` no Esc. Requisito WCAG para diálogos modais.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean, onEscape?: () => void) {
  const containerRef = useRef<T>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  // Callers costumam passar `onEscape` inline (nova referência a cada render) — guardar num ref e
  // não colocar na dependência do efeito evita reabrir o trap (e reforçar foco no 1º elemento) a
  // cada tecla digitada dentro do modal, que antes chutava o foco pro botão de fechar.
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const focusables = container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusables?.[0] ?? container)?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onEscapeRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !container) return;

      const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [active]);

  return containerRef;
}
