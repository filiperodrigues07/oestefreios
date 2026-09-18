/** Formato genérico o bastante pra alimentar prévia na tela, Excel e PDF a partir do mesmo dado. */
export interface RelatorioColuna {
  key: string;
  label: string;
  tipo?: 'texto' | 'numero' | 'moeda' | 'data';
  alinhamento?: 'left' | 'right';
}

export type RelatorioValor = string | number | boolean | null;

export interface RelatorioResultado {
  titulo: string;
  geradoEm: string;
  periodo?: { inicio: string; fim: string };
  colunas: RelatorioColuna[];
  linhas: Record<string, RelatorioValor>[];
}
