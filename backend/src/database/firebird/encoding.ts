/**
 * O CHERP deste cliente tem colunas de texto declaradas com charset NONE
 * (herança de bancos Interbase/Firebird antigos), mas os bytes reais são
 * Windows-1252/Latin1. O driver node-firebird decodifica colunas NONE como
 * UTF-8 e corrompe qualquer acentuação (vira U+FFFD, irrecuperável).
 *
 * Solução comprovada contra o banco real: fazer CAST(coluna AS VARCHAR(n)
 * CHARACTER SET OCTETS) no SQL — isso faz o driver devolver um Buffer cru
 * em vez de tentar decodificar como texto — e então decodificar esse Buffer
 * como latin1 aqui. Para buscas (LIKE) com termo acentuado, o inverso:
 * o parâmetro precisa ir como Buffer latin1, nunca como string JS (que o
 * driver envia em UTF-8 e não bate com os bytes latin1 armazenados).
 */

export function toLatin1Param(value: string): Buffer {
  return Buffer.from(value, 'latin1');
}

/**
 * Termo de busca para LIKE contra coluna envolvida em UPPER(...) — ver os
 * QUERY_BUSCAR_* de cada repositório Firebird. Sem isso a comparação vira
 * case-sensitive na prática (Firebird não faz collation acentuada para
 * colunas charset NONE, então isso resolve o caso comum de maiúsc./minúsc.,
 * não acentos: buscar "veiculo" ainda não bate com "VEÍCULO").
 */
export function toLatin1SearchParam(term: string): Buffer {
  return Buffer.from(`%${term.toUpperCase()}%`, 'latin1');
}

export function decodeLatin1Row<T extends Record<string, unknown>>(row: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[key] = Buffer.isBuffer(value) ? value.toString('latin1') : value;
  }
  return result as T;
}
