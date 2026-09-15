/** Ordenação estável por código ou descrição — usada pelos mocks de catálogo (Fase 6). */
export function sortByField<T>(
  items: T[],
  field: 'codigo' | 'descricao',
  order: 'asc' | 'desc',
  getField: (item: T, field: 'codigo' | 'descricao') => string,
): T[] {
  const sorted = [...items].sort((a, b) => getField(a, field).localeCompare(getField(b, field), 'pt-BR'));
  return order === 'desc' ? sorted.reverse() : sorted;
}
