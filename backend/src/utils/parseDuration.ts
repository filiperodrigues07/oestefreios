const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** Converte durações simples ("15m", "7d", "30s") em milissegundos. */
export function parseDurationMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Duração inválida: "${duration}"`);
  }
  const [, amount, unit] = match;
  return Number(amount) * UNIT_MS[unit!]!;
}
