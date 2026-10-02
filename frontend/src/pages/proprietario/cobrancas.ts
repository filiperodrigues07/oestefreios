import type { CobrancaDTO } from '../../types/billing.types.js';

/** Regras puras da lista de cobranças (filtros, meses em lote, CSV) — testadas em cobrancas.test.ts. */

export type FiltroCobranca = 'abertas' | 'vencidas' | 'semBoleto' | 'pagas' | 'todas';

export function vencimentoDoMes(referencia: string, diaVencimento: number): string {
  const [ano, mes] = referencia.split('-').map(Number) as [number, number];
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${referencia}-${String(Math.min(diaVencimento, ultimoDia)).padStart(2, '0')}`;
}

export function referenciasSeguidas(inicio: string, meses: number): string[] {
  const [ano, mes] = inicio.split('-').map(Number) as [number, number];
  return Array.from({ length: meses }, (_, i) => {
    const total = ano * 12 + (mes - 1) + i;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
  });
}

/** Primeiro mês sem cobrança a partir do mês do vencimento atual (ou do mês de hoje). */
export function proximaReferenciaLivre(cobrancas: CobrancaDTO[], base: string): string {
  const usadas = new Set(cobrancas.map((item) => item.referencia));
  let referencia = base.slice(0, 7);
  for (let i = 0; i < 120 && usadas.has(referencia); i += 1) {
    referencia = referenciasSeguidas(referencia, 2)[1]!;
  }
  return referencia;
}

export function estaVencida(cobranca: CobrancaDTO, hoje: string): boolean {
  return !cobranca.pagoEm && cobranca.vencimento < hoje;
}

export function filtrarCobrancas(
  cobrancas: CobrancaDTO[],
  filtro: FiltroCobranca,
  hoje: string,
): CobrancaDTO[] {
  const lista = cobrancas.filter((item) => {
    if (filtro === 'abertas') return !item.pagoEm;
    if (filtro === 'vencidas') return estaVencida(item, hoje);
    if (filtro === 'semBoleto') return !item.pagoEm && !item.arquivoNome;
    if (filtro === 'pagas') return Boolean(item.pagoEm);
    return true;
  });
  // Pagas: a mais recente primeiro. Demais: o que vence antes aparece antes.
  return lista.sort((a, b) =>
    filtro === 'pagas'
      ? b.vencimento.localeCompare(a.vencimento)
      : a.vencimento.localeCompare(b.vencimento) || a.referencia.localeCompare(b.referencia),
  );
}

export function contarFiltros(
  cobrancas: CobrancaDTO[],
  hoje: string,
): Record<FiltroCobranca, number> {
  return {
    abertas: cobrancas.filter((item) => !item.pagoEm).length,
    vencidas: cobrancas.filter((item) => estaVencida(item, hoje)).length,
    semBoleto: cobrancas.filter((item) => !item.pagoEm && !item.arquivoNome).length,
    pagas: cobrancas.filter((item) => Boolean(item.pagoEm)).length,
    todas: cobrancas.length,
  };
}

function diasEntre(de: string, ate: string): number {
  const utc = (iso: string) => {
    const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number) as [number, number, number];
    return Date.UTC(ano, mes - 1, dia);
  };
  return Math.round((utc(ate) - utc(de)) / 86_400_000);
}

const dataCsv = (iso: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : '';
const valorCsv = (valor: number) => valor.toFixed(2).replace('.', ',');
const celula = (valor: string | number) => {
  const texto = String(valor);
  return /[;"\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

/**
 * CSV no padrão brasileiro (`;`, vírgula decimal, data dd/mm/aaaa, BOM UTF-8): abre direto no Excel e
 * entra no Power BI sem mexer no tipo das colunas. Dias de atraso: pago = pagamento − vencimento;
 * em aberto = hoje − vencimento (negativo = ainda não venceu).
 */
export function cobrancasCsv(cobrancas: CobrancaDTO[], hoje: string): string {
  const cabecalho = [
    'Referência',
    'Vencimento',
    'Valor',
    'Situação',
    'Pago em',
    'Dias de atraso',
    'Boleto anexado',
    'Enviado em',
    'Envios',
    'Observação',
  ];
  const linhas = [...cobrancas]
    .sort((a, b) => a.referencia.localeCompare(b.referencia))
    .map((item) => {
      const situacao = item.pagoEm ? 'Paga' : estaVencida(item, hoje) ? 'Vencida' : 'Em aberto';
      const atraso = diasEntre(item.vencimento, item.pagoEm ?? hoje);
      return [
        item.referencia.split('-').reverse().join('/'),
        dataCsv(item.vencimento),
        valorCsv(item.valor),
        situacao,
        dataCsv(item.pagoEm),
        atraso,
        item.arquivoNome ? 'Sim' : 'Não',
        dataCsv(item.enviadoEm),
        item.envios,
        item.observacao,
      ]
        .map(celula)
        .join(';');
    });
  return `\uFEFF${[cabecalho.join(';'), ...linhas].join('\r\n')}\r\n`;
}
