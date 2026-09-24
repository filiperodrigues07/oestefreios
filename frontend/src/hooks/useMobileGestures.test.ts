import { describe, expect, it } from 'vitest';
import { gestureCompleted } from './useMobileGestures.js';

describe('gestos mobile', () => {
  it('abre e fecha o menu apenas com deslize horizontal suficiente', () => {
    expect(gestureCompleted('open-menu', 80, 8)).toBe(true);
    expect(gestureCompleted('open-menu', 60, 0)).toBe(false);
    expect(gestureCompleted('open-menu', 80, 80)).toBe(false);
    expect(gestureCompleted('close-menu', -80, 8)).toBe(true);
    expect(gestureCompleted('close-menu', 80, 8)).toBe(false);
  });

  it('atualiza apenas com deslize vertical para baixo', () => {
    expect(gestureCompleted('refresh', 8, 80)).toBe(true);
    expect(gestureCompleted('refresh', 0, 60)).toBe(false);
    expect(gestureCompleted('refresh', 80, 80)).toBe(false);
    expect(gestureCompleted('refresh', 0, -80)).toBe(false);
  });
});
