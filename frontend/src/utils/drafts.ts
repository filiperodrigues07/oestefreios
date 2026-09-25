/**
 * Rascunho local de texto longo (ex.: diagnóstico da OS) — sobrevive a app fechado, celular
 * travado ou sessão expirada no meio da digitação. Fica só no aparelho, separado por usuário,
 * e é apagado ao salvar com sucesso ou no logout explícito (`clearAllDrafts`).
 *
 * Todo acesso ao localStorage é protegido: aba anônima/armazenamento bloqueado só desliga o rascunho.
 */
const PREFIXO = 'draft:';

export interface Draft<T> {
  data: T;
  savedAt: string;
}

export function draftKey(userId: string, ...partes: string[]): string {
  return `${PREFIXO}${userId}:${partes.join(':')}`;
}

export function readDraft<T>(key: string): Draft<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft<T>;
    return parsed && typeof parsed === 'object' && 'data' in parsed ? parsed : null;
  } catch {
    return null;
  }
}

export function writeDraft<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, savedAt: new Date().toISOString() } satisfies Draft<T>));
  } catch {
    // Sem espaço/armazenamento bloqueado: segue sem rascunho.
  }
}

export function removeDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignora
  }
}

/** Logout: nenhum texto de cliente fica no aparelho depois que o usuário sai. */
export function clearAllDrafts(): void {
  try {
    const chaves: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIXO)) chaves.push(key);
    }
    chaves.forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignora
  }
}
