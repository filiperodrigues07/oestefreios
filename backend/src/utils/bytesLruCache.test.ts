import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { criarBytesLruCache } from './bytesLruCache.js';

describe('bytesLruCache', () => {
  const original = process.env.NODE_ENV;
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });
  afterEach(() => {
    process.env.NODE_ENV = original;
  });

  it('expulsa o menos recente ao passar do teto de bytes', () => {
    const cache = criarBytesLruCache(10);
    cache.guardar('a', Buffer.alloc(4));
    cache.guardar('b', Buffer.alloc(4));
    cache.obter('a'); // a fica mais recente que b
    cache.guardar('c', Buffer.alloc(4));
    expect(cache.obter('b')).toBeUndefined();
    expect(cache.obter('a')).toBeDefined();
    expect(cache.obter('c')).toBeDefined();
  });

  it('ignora item maior que o teto e remove por prefixo', () => {
    const cache = criarBytesLruCache(10);
    cache.guardar('grande', Buffer.alloc(11));
    expect(cache.obter('grande')).toBeUndefined();
    cache.guardar('os1:x', Buffer.alloc(2));
    cache.guardar('os1:y', Buffer.alloc(2));
    cache.guardar('os2:x', Buffer.alloc(2));
    cache.remover('os1:');
    expect(cache.obter('os1:x')).toBeUndefined();
    expect(cache.obter('os1:y')).toBeUndefined();
    expect(cache.obter('os2:x')).toBeDefined();
  });

  it('desligado em NODE_ENV=test', () => {
    process.env.NODE_ENV = 'test';
    const cache = criarBytesLruCache(10);
    cache.guardar('a', Buffer.alloc(2));
    expect(cache.obter('a')).toBeUndefined();
  });
});
