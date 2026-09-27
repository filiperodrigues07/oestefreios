/**
 * ORDEMSERVICO.OBS é o campo "Observação" do CHERP: texto livre, igual a quem digita direto lá.
 * O app não guarda mais nada estruturado aqui (o antigo "serviço realizado" não tem campo no CHERP).
 */
export function encodeObsTexto(observacoes?: string): string | null {
  const obs = observacoes?.trim() ?? '';
  return obs ? obs : null;
}

const MARCADOR_OBS = /^\s*\[OBSERVACOES\][ \t]*(?:\n)?/;
const MARCADOR_SOLUCAO = /(?:\n)?[ \t]*\[SOLUCAO\][ \t]*(?:\n)?/;
const QUALQUER_MARCADOR = /\[(OBSERVACOES|SOLUCAO)\]/g;

/**
 * Lê OBS gravado por versões antigas do app ([OBSERVACOES]…[SOLUCAO]…), inclusive como volta do CHERP
 * (\r\n, linha final cortada, marcadores repetidos, cópia feita pelo "Duplicar" do CHERP). O texto que
 * era "serviço realizado" vai pro fim das observações — nada se perde; ao salvar, o CHERP fica limpo.
 */
export function decodeObsTexto(raw: unknown): { observacoes?: string } {
  let texto = raw == null ? '' : String(raw).replace(/\r\n/g, '\n');
  let solucao: string | undefined;
  for (let i = 0; i < 5 && MARCADOR_OBS.test(texto); i++) {
    texto = texto.replace(MARCADOR_OBS, '');
    const partes = texto.split(MARCADOR_SOLUCAO);
    if (partes.length > 1) {
      texto = partes[0]!;
      const resto = partes.slice(1).join('\n').replace(QUALQUER_MARCADOR, '').trim();
      if (resto && solucao === undefined) solucao = resto;
    }
  }
  const observacoes = [texto.replace(QUALQUER_MARCADOR, '').trim(), solucao].filter(Boolean).join('\n');
  return { observacoes: observacoes || undefined };
}

/** OBS ainda com marcadores do formato antigo — alvo do script de limpeza (scripts/limparMarcadoresObs.ts). */
export function temMarcadorAntigo(raw: unknown): boolean {
  return raw != null && /\[(OBSERVACOES|SOLUCAO)\]/.test(String(raw));
}
