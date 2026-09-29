const STOP_WORDS = new Set(['A', 'AS', 'DA', 'DAS', 'DE', 'DO', 'DOS', 'E', 'O', 'OS']);

export function normalizeCatalogText(value: string): string {
  return value.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function catalogTokens(term: string): string[] {
  const words = normalizeCatalogText(term).match(/[\p{L}\p{N}]+/gu) ?? [];
  const meaningful = words.filter((word) => !STOP_WORDS.has(word));
  return [...new Set(meaningful.length ? meaningful : words)].slice(0, 10);
}

export function matchesCatalogSearch(term: string, fields: (string | undefined)[]): boolean {
  const tokens = catalogTokens(term);
  return tokens.every((token) => fields.some((field) => field && normalizeCatalogText(field).includes(token)));
}
