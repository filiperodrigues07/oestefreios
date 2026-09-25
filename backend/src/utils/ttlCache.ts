/**
 * Cache em memória com validade curta e deduplicação de chamadas simultâneas: se 10 usuários abrem o
 * dashboard no mesmo instante, só 1 consulta vai ao banco. Erros não são guardados.
 * Desligado em NODE_ENV=test para os testes enxergarem sempre o dado atual.
 */
export interface TtlCache<T> {
  obter(chave: string, carregar: () => Promise<T>): Promise<T>;
  limpar(chave?: string): void;
}

export function criarTtlCache<T>(ttlMs: number, maximo = 200): TtlCache<T> {
  const valores = new Map<string, { expira: number; promessa: Promise<T> }>();
  return {
    obter(chave, carregar) {
      if (process.env.NODE_ENV === 'test' || ttlMs <= 0) return carregar();
      const agora = Date.now();
      const existente = valores.get(chave);
      if (existente && existente.expira > agora) return existente.promessa;
      const promessa = carregar();
      if (valores.size >= maximo) valores.delete(valores.keys().next().value!);
      valores.set(chave, { expira: agora + ttlMs, promessa });
      promessa.catch(() => {
        if (valores.get(chave)?.promessa === promessa) valores.delete(chave);
      });
      return promessa;
    },
    limpar(chave) {
      if (chave === undefined) valores.clear();
      else valores.delete(chave);
    },
  };
}
