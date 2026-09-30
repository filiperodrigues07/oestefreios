/**
 * Cache LRU em memória limitado por BYTES (não por quantidade): miniaturas de fotos da OS custam
 * ~30-60 KB cada, então o teto de bytes protege a VPS (3,8 GB) de crescer sem limite.
 * Desligado em NODE_ENV=test pra os testes enxergarem sempre o dado atual.
 */
export interface BytesLruCache {
  obter(chave: string): Buffer | undefined;
  guardar(chave: string, valor: Buffer): void;
  remover(prefixo: string): void;
}

export function criarBytesLruCache(maxBytes: number): BytesLruCache {
  const itens = new Map<string, Buffer>();
  let total = 0;
  const desligado = () => process.env.NODE_ENV === 'test';
  return {
    obter(chave) {
      if (desligado()) return undefined;
      const valor = itens.get(chave);
      if (valor === undefined) return undefined;
      itens.delete(chave); // reinsere no fim: mais recente
      itens.set(chave, valor);
      return valor;
    },
    guardar(chave, valor) {
      if (desligado() || valor.length > maxBytes) return;
      const antigo = itens.get(chave);
      if (antigo) {
        total -= antigo.length;
        itens.delete(chave);
      }
      itens.set(chave, valor);
      total += valor.length;
      while (total > maxBytes) {
        const maisAntigo = itens.keys().next().value as string;
        total -= itens.get(maisAntigo)!.length;
        itens.delete(maisAntigo);
      }
    },
    remover(prefixo) {
      for (const [chave, valor] of itens) {
        if (chave.startsWith(prefixo)) {
          total -= valor.length;
          itens.delete(chave);
        }
      }
    },
  };
}
