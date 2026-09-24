export const MIN_COLUMN_WIDTH = 56;
export const MAX_COLUMN_WIDTH = 640;

export interface ColumnPrefs {
  order: string[];
  widths: Record<string, number>;
}

const PREFS_VERSION = 'v2';

export function clampWidth(px: number): number {
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(px)));
}

/** Valida o que veio do localStorage (pode estar corrompido, ser de versão antiga ou editado à mão). */
export function sanitizePrefs(raw: unknown): ColumnPrefs | null {
  if (!raw || typeof raw !== 'object') return null;
  const { order, widths } = raw as { order?: unknown; widths?: unknown };
  if (!Array.isArray(order) || !widths || typeof widths !== 'object' || Array.isArray(widths)) return null;

  const ordemLimpa = [...new Set(order.filter((key): key is string => typeof key === 'string'))].slice(0, 100);
  const largurasLimpas: Record<string, number> = {};
  for (const [key, value] of Object.entries(widths as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value)) largurasLimpas[key] = clampWidth(value);
  }
  return { order: ordemLimpa, widths: largurasLimpas };
}

export function hasCustomPrefs(prefs: ColumnPrefs | null): boolean {
  return Boolean(prefs && (prefs.order.length > 0 || Object.keys(prefs.widths).length > 0));
}

/** Aplica a ordem salva: colunas novas vão pro fim, chaves que sumiram são descartadas. */
export function applyOrder<T extends { key: string }>(columns: T[], order: string[] | null): T[] {
  if (!order || order.length === 0) return columns;
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const ordenadas = order.map((key) => byKey.get(key)).filter((column): column is T => Boolean(column));
  const faltando = columns.filter((column) => !order.includes(column.key));
  return [...ordenadas, ...faltando];
}

const versionedKey = (key: string) => `table-prefs:${PREFS_VERSION}:${key}`;
const legacyKey = (key: string) => `table-prefs:${key}`;

export function loadPrefs(key: string): ColumnPrefs | null {
  try {
    const atual = localStorage.getItem(versionedKey(key));
    if (atual) return sanitizePrefs(JSON.parse(atual));
    const antiga = localStorage.getItem(legacyKey(key));
    if (!antiga) return null;
    const migrada = sanitizePrefs(JSON.parse(antiga));
    if (migrada) savePrefs(key, migrada);
    localStorage.removeItem(legacyKey(key));
    return migrada;
  } catch {
    return null;
  }
}

export function savePrefs(key: string, prefs: ColumnPrefs): void {
  try {
    localStorage.setItem(versionedKey(key), JSON.stringify(prefs));
  } catch {
    // Navegador privado/bloqueado — só perde a preferência salva, a tabela continua funcionando.
  }
}

export function clearPrefs(key: string): void {
  try {
    localStorage.removeItem(versionedKey(key));
    localStorage.removeItem(legacyKey(key));
  } catch {
    // Idem: sem localStorage, nada a limpar.
  }
}
