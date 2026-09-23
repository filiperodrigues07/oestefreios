/** Valor de <input type="date"> no calendário local, sem deslocamento por UTC. */
export function calendarDateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
