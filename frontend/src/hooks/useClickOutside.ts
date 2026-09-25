import { useEffect, useRef, type RefObject } from 'react';

/**
 * Chama `onOutside` quando o usuário toca/clica fora do elemento. Usa `pointerdown`, que cobre mouse, toque e caneta
 * (o `mousedown` sozinho não dispara em todo toque). Ativo só enquanto `active` — menus fechados não escutam nada.
 */
export function useClickOutside(ref: RefObject<HTMLElement | null>, onOutside: () => void, active = true) {
  const callback = useRef(onOutside);
  useEffect(() => {
    callback.current = onOutside;
  }, [onOutside]);

  useEffect(() => {
    if (!active) return;
    function handle(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) callback.current();
    }
    document.addEventListener('pointerdown', handle);
    return () => document.removeEventListener('pointerdown', handle);
  }, [ref, active]);
}
