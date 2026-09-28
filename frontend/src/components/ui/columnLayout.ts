export const MIN_COLUMN_WIDTH = 56;
export const MAX_COLUMN_WIDTH = 640;

export interface ColumnPrefs {
  order: string[];
  widths: Record<string, number>;
  /** Colunas que a pessoa escolheu esconder (botão "Colunas"). */
  hidden: string[];
}

export const EMPTY_PREFS: ColumnPrefs = { order: [], widths: {}, hidden: [] };

const PREFS_VERSION = 'v3';

export function clampWidth(px: number): number {
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(px)));
}

function chavesUnicas(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return [...new Set(valor.filter((key): key is string => typeof key === 'string'))].slice(0, 100);
}

/** Valida o que veio do localStorage (pode estar corrompido, ser de versão antiga ou editado à mão). */
export function sanitizePrefs(raw: unknown): ColumnPrefs | null {
  if (!raw || typeof raw !== 'object') return null;
  const { order, widths, hidden } = raw as { order?: unknown; widths?: unknown; hidden?: unknown };
  if (!Array.isArray(order) || !widths || typeof widths !== 'object' || Array.isArray(widths)) return null;

  const largurasLimpas: Record<string, number> = {};
  for (const [key, value] of Object.entries(widths as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value)) largurasLimpas[key] = clampWidth(value);
  }
  // Preferência salva antes das colunas ocultas não tem `hidden`: vale como "nenhuma escondida".
  return { order: chavesUnicas(order), widths: largurasLimpas, hidden: chavesUnicas(hidden) };
}

export function hasCustomPrefs(prefs: ColumnPrefs | null): boolean {
  return Boolean(prefs && (prefs.order.length > 0 || Object.keys(prefs.widths).length > 0 || prefs.hidden.length > 0));
}

/** Aplica a ordem salva: colunas novas vão pro fim, chaves que sumiram são descartadas. */
export function applyOrder<T extends { key: string }>(columns: T[], order: string[] | null): T[] {
  if (!order || order.length === 0) return columns;
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const ordenadas = order.map((key) => byKey.get(key)).filter((column): column is T => Boolean(column));
  const faltando = columns.filter((column) => !order.includes(column.key));
  return [...ordenadas, ...faltando];
}

/**
 * Move `key` pra posição `destino` (índice de inserção entre as colunas, 0 = antes da primeira,
 * length = depois da última), como a linha azul mostra durante o arraste.
 */
export function moverColuna(ordem: string[], key: string, destino: number): string[] {
  const de = ordem.indexOf(key);
  if (de === -1) return ordem;
  const semEla = ordem.filter((k) => k !== key);
  const alvo = Math.max(0, Math.min(semEla.length, destino > de ? destino - 1 : destino));
  const nova = [...semEla.slice(0, alvo), key, ...semEla.slice(alvo)];
  return nova.every((k, i) => k === ordem[i]) ? ordem : nova;
}

/** Liga/desliga uma coluna. Nunca esconde a última visível: tabela sem coluna nenhuma não serve pra nada. */
export function alternarVisivel(hidden: string[], key: string, todas: string[]): string[] {
  if (hidden.includes(key)) return hidden.filter((k) => k !== key);
  const visiveis = todas.filter((k) => !hidden.includes(k));
  if (visiveis.length <= 1 && visiveis.includes(key)) return hidden;
  return [...hidden, key];
}

const versionedKey = (key: string) => `table-prefs:${PREFS_VERSION}:${key}`;
const legacyKey = (key: string) => `table-prefs:${key}`;

/**
 * Preferência por usuário e por tela (computador da oficina é compartilhado). Na primeira vez de cada
 * usuário, parte do que estava salvo no navegador antes de a preferência ser por usuário.
 */
export function prefsKey(tabela: string, userId?: string): string {
  return userId ? `${userId}:${tabela}` : tabela;
}

export function loadPrefs(key: string, fallbackKey?: string): ColumnPrefs | null {
  try {
    const atual = localStorage.getItem(versionedKey(key));
    if (atual) return sanitizePrefs(JSON.parse(atual));
    if (fallbackKey && fallbackKey !== key) {
      const compartilhada = localStorage.getItem(versionedKey(fallbackKey));
      if (compartilhada) return sanitizePrefs(JSON.parse(compartilhada));
    }
    const antiga = localStorage.getItem(legacyKey(fallbackKey ?? key));
    if (!antiga) return null;
    return sanitizePrefs(JSON.parse(antiga));
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
  } catch {
    // Idem: sem localStorage, nada a limpar.
  }
}
