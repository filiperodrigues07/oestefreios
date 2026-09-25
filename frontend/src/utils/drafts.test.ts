import { beforeEach, describe, expect, it } from 'vitest';
import { clearAllDrafts, draftKey, readDraft, removeDraft, writeDraft } from './drafts.js';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i) => Array.from(map.keys())[i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
  };
}

describe('drafts', () => {
  beforeEach(() => {
    globalThis.localStorage = memoryStorage();
  });

  it('grava, lê e remove rascunho por usuário', () => {
    const key = draftKey('u1', 'os', 'abc', 'diagnostico');
    writeDraft(key, { texto: 'freio traseiro' });
    expect(readDraft<{ texto: string }>(key)?.data.texto).toBe('freio traseiro');
    expect(readDraft(draftKey('u2', 'os', 'abc', 'diagnostico'))).toBeNull();
    removeDraft(key);
    expect(readDraft(key)).toBeNull();
  });

  it('logout apaga só os rascunhos', () => {
    writeDraft(draftKey('u1', 'a'), 1);
    writeDraft(draftKey('u2', 'b'), 2);
    localStorage.setItem('tema', 'escuro');
    clearAllDrafts();
    expect(localStorage.length).toBe(1);
    expect(localStorage.getItem('tema')).toBe('escuro');
  });

  it('JSON corrompido não quebra a tela', () => {
    localStorage.setItem('draft:u1:x', '{quebrado');
    expect(readDraft('draft:u1:x')).toBeNull();
  });
});
