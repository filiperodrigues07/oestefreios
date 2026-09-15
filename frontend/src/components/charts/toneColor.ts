import type { BadgeTone } from '../ui/Badge.js';

/** Cor sólida (pra preencher barra) correspondente ao tom do Badge — mesma identidade visual dos badges de status/prioridade já usados no resto do app. */
export function toneToColor(tone: BadgeTone): string {
  const map: Record<BadgeTone, string> = {
    primary: 'var(--color-primary)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    danger: 'var(--color-danger)',
    info: 'var(--color-info)',
    neutral: 'var(--chart-muted)',
  };
  return map[tone];
}
