/**
 * ORDEMSERVICO.OBS guarda duas coisas do app: observações e "serviço realizado" (o CHERP não tem
 * coluna própria pra solução). Só com observações, grava texto puro, igual a quem digita direto no
 * CHERP. Com solução, separa as partes com os marcadores [OBSERVACOES] e [SOLUCAO].
 */
export function encodeObsTexto(observacoes?: string, solucao?: string): string | null {
  const obs = observacoes?.trim() ?? '';
  const sol = solucao?.trim() ?? '';
  if (!obs && !sol) return null;
  if (!sol) return obs;
  return `[OBSERVACOES]\n${obs}\n[SOLUCAO]\n${sol}`;
}

const MARCADOR_OBS = /^\s*\[OBSERVACOES\][ \t]*(?:\n)?/;
const MARCADOR_SOLUCAO = /(?:\n)?[ \t]*\[SOLUCAO\][ \t]*(?:\n)?/;
const QUALQUER_MARCADOR = /\[(OBSERVACOES|SOLUCAO)\]/g;

/**
 * Tolerante ao que volta do CHERP: quebra de linha \r\n, linha final cortada e marcadores repetidos
 * (texto salvo de novo enquanto a leitura antiga falhava e mostrava os marcadores na tela). Nunca
 * devolve marcador pra tela; ao salvar de novo, o texto volta ao formato limpo.
 */
export function decodeObsTexto(raw: unknown): { observacoes?: string; solucao?: string } {
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
  const observacoes = texto.replace(QUALQUER_MARCADOR, '').trim();
  return { observacoes: observacoes || undefined, solucao: solucao || undefined };
}
