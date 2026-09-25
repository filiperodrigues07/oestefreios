import { describe, expect, it, vi } from 'vitest';

// Teste de lógica pura: simula window/document mínimos (o ambiente de teste é node).
const listeners: ((e: KeyboardEvent) => void)[] = [];
vi.stubGlobal('window', {
  addEventListener: (_: string, fn: (e: KeyboardEvent) => void) => listeners.push(fn),
  removeEventListener: () => undefined,
});
let dialogo = false;
vi.stubGlobal('document', { querySelector: () => (dialogo ? {} : null) });
vi.mock('react', () => ({ useEffect: (fn: () => void) => fn() }));

const { useAppShortcuts } = await import('./useAppShortcuts.js');

function tecla(key: string, target: Partial<HTMLElement> = { tagName: 'BODY' }, extra: Partial<KeyboardEvent> = {}) {
  const evento = { key, target, preventDefault: vi.fn(), defaultPrevented: false, ...extra } as unknown as KeyboardEvent;
  listeners.forEach((fn) => fn(evento));
  return evento;
}

describe('useAppShortcuts', () => {
  const novaOS = vi.fn();
  const focarBusca = vi.fn();
  useAppShortcuts({ novaOS, focarBusca });

  it('N abre nova OS e / foca a busca', () => {
    tecla('n');
    tecla('/');
    expect(novaOS).toHaveBeenCalledTimes(1);
    expect(focarBusca).toHaveBeenCalledTimes(1);
  });

  it('ignora quando está digitando, com Ctrl ou com diálogo aberto', () => {
    novaOS.mockClear();
    tecla('n', { tagName: 'TEXTAREA' });
    tecla('n', { tagName: 'BODY' }, { ctrlKey: true });
    dialogo = true;
    tecla('n');
    dialogo = false;
    expect(novaOS).not.toHaveBeenCalled();
  });
});
