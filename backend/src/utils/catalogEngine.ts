import { CATALOG_SYNONYM_GROUPS } from './catalogSynonyms.js';

/**
 * Motor de busca do catálogo (produtos e serviços) — puro, sem I/O, igual no Firebird e no mock.
 *
 * O CHERP guarda descrição com até 40 caracteres, cheia de abreviação ("BUCHA MOLA DT", "CAR.", "SEXT.")
 * e medidas coladas ("15W40"). Um `LIKE %palavra%` só acha quem digita exatamente igual. Aqui cada palavra
 * digitada é comparada com as palavras do item por (do mais ao menos confiável): igual, sinônimo/abreviação,
 * mesmo radical (plural/gênero), prefixo, trecho e, por último, erro de digitação. Todas as palavras digitadas
 * precisam casar (E). Resultado só por erro de digitação ou com uma palavra faltando volta marcado `parecido`.
 */

export interface CatalogItemInput {
  codigo: string;
  descricao: string;
  /** Texto do grupo/categoria — também é buscado, com peso menor que a descrição. */
  grupo?: string;
  /** Texto do tipo — idem. */
  tipoTexto?: string;
  /** Código do tipo para filtros (produto: PRODUTO.TIPO; serviço: código do tipo de serviço). */
  tipo?: string | number;
}

interface Palavra {
  w: string;
  stem: string;
  canon: string | null;
  peso: number;
  numerica: boolean;
  fon: string;
}

export interface IndexedEntry {
  codigo: string;
  codigoSemZeros: string;
  descricao: string;
  grupo: string;
  tipoTexto: string;
  tipo?: string | number;
  palavras: Palavra[];
  /** Quantas palavras vêm da descrição (as demais são de grupo/tipo). */
  nDescricao: number;
}

export interface CatalogIndex {
  entries: IndexedEntry[];
  criadoEm: number;
}

export interface CatalogHit {
  entry: IndexedEntry;
  score: number;
  /** Achado por erro de digitação ou com palavra faltando: a interface avisa "parecido". */
  parecido: boolean;
}

const STOP_WORDS = new Set([
  'A', 'AS', 'O', 'OS', 'DE', 'DA', 'DAS', 'DO', 'DOS', 'E', 'EM', 'NA', 'NO', 'NAS', 'NOS', 'UM', 'UMA',
  'PARA', 'COM', 'SEM', 'P', 'C', 'S', 'X',
]);

/** Máximo de resultados só-por-erro-de-digitação exibidos quando já há bons resultados exatos. */
const SO_MOSTRA_PARECIDO_SE_EXATOS_MENOS_QUE = 8;

export function normalizar(valor: string): string {
  return valor.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[ºª°]/g, '');
}

/** Letras e números viram palavras separadas: `15W-40`, `15W40` e `15 w 40` são a mesma coisa. */
export function tokenizar(valor: string): string[] {
  return normalizar(valor).match(/[A-Z]+|[0-9]+/g) ?? [];
}

/** Radical simples do português: tira plural e a vogal final de gênero (PASTILHAS→PASTILH, DIANTEIRA→DIANTEIR). */
export function radical(palavra: string): string {
  if (palavra.length < 4 || /^\d+$/.test(palavra)) return palavra;
  let s = palavra;
  if (/(OES|AES|AOS)$/.test(s)) return `${s.slice(0, -3)}AO`;
  if (/[RZ]ES$/.test(s) && s.length > 5) s = s.slice(0, -2);
  else if (s.endsWith('S') && !s.endsWith('SS')) s = s.slice(0, -1);
  if (s.length >= 5 && /[AOE]$/.test(s)) s = s.slice(0, -1);
  return s;
}

/**
 * Aproximação do som em português, para erro de escrita que a distância de edição não pega
 * (BUXA≈BUCHA, PARAFUZO≈PARAFUSO, CILINDRO≈SILINDRO).
 */
export function fonetica(palavra: string): string {
  return palavra
    .replace(/CH|SH/g, 'X')
    .replace(/PH/g, 'F')
    .replace(/LH/g, 'L')
    .replace(/NH/g, 'N')
    .replace(/SC(?=[EI])/g, 'S')
    .replace(/C(?=[EI])/g, 'S')
    .replace(/[CQ]/g, 'K')
    .replace(/[ZJ]/g, 'S')
    .replace(/Y/g, 'I')
    .replace(/W/g, 'V')
    .replace(/H/g, '')
    .replace(/(.)\1+/g, '$1');
}

const SINONIMOS = (() => {
  const mapa = new Map<string, string>();
  for (const grupo of CATALOG_SYNONYM_GROUPS) {
    const id = grupo[0]!;
    for (const palavra of grupo) {
      mapa.set(palavra, id);
      mapa.set(radical(palavra), id);
    }
  }
  return mapa;
})();

function criarPalavra(w: string, peso: number): Palavra {
  const numerica = /^\d+$/.test(w);
  return { w, stem: radical(w), canon: numerica ? null : (SINONIMOS.get(w) ?? SINONIMOS.get(radical(w)) ?? null), peso, numerica, fon: numerica ? w : fonetica(w) };
}

/** Distância de edição com troca de letras vizinhas (digitar "amortecedro" em vez de "amortecedor" = 1). */
export function distanciaEdicao(a: string, b: string, limite: number): number {
  if (Math.abs(a.length - b.length) > limite) return limite + 1;
  const linhas: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    linhas.push(new Array<number>(b.length + 1).fill(0));
    linhas[i]![0] = i;
  }
  for (let j = 0; j <= b.length; j++) linhas[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      let melhor = Math.min(linhas[i - 1]![j]! + 1, linhas[i]![j - 1]! + 1, linhas[i - 1]![j - 1]! + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) melhor = Math.min(melhor, linhas[i - 2]![j - 2]! + 1);
      linhas[i]![j] = melhor;
    }
  }
  return linhas[a.length]![b.length]!;
}

export function construirIndice(itens: CatalogItemInput[], agora = Date.now()): CatalogIndex {
  const entries = itens.map((item): IndexedEntry => {
    const descricao = tokenizar(item.descricao).map((w) => criarPalavra(w, 1));
    const extras = [...tokenizar(item.grupo ?? ''), ...tokenizar(item.tipoTexto ?? '')].map((w) => criarPalavra(w, 0.7));
    const codigo = item.codigo.trim();
    return {
      codigo,
      codigoSemZeros: codigo.replace(/^0+/, ''),
      descricao: item.descricao,
      grupo: item.grupo ?? '',
      tipoTexto: item.tipoTexto ?? '',
      tipo: item.tipo,
      palavras: [...descricao, ...extras],
      nDescricao: descricao.length,
    };
  });
  return { entries, criadoEm: agora };
}

interface Consulta {
  w: string;
  stem: string;
  canon: string | null;
  numerica: boolean;
  fon: string;
}

function consultaDe(termo: string): Consulta[] {
  const todas = [...new Set(tokenizar(termo))];
  const uteis = todas.filter((w) => !STOP_WORDS.has(w));
  return (uteis.length ? uteis : todas).slice(0, 10).map((w) => {
    const p = criarPalavra(w, 1);
    return { w, stem: p.stem, canon: p.canon, numerica: p.numerica, fon: p.fon };
  });
}

interface Casamento {
  score: number;
  fuzzy: boolean;
}

function casar(q: Consulta, p: Palavra): Casamento | null {
  if (q.w === p.w) return { score: 1, fuzzy: false };
  if (q.numerica || p.numerica) {
    // Número só casa inteiro, ou como início de um número maior quando já tem 3+ dígitos ("150" acha "1503").
    return q.numerica && p.numerica && q.w.length >= 3 && p.w.startsWith(q.w) ? { score: 0.7, fuzzy: false } : null;
  }
  if (q.canon && q.canon === p.canon) return { score: 0.92, fuzzy: false };
  if (q.w.length < 2) return null;
  if (q.w.length >= 3 && q.stem === p.stem) return { score: 0.9, fuzzy: false };
  if (p.w.startsWith(q.w)) return { score: 0.8, fuzzy: false };
  if (q.w.length >= 3 && q.stem.length >= 3 && p.stem.startsWith(q.stem)) return { score: 0.75, fuzzy: false };
  if (q.w.length >= 3 && p.w.includes(q.w)) return { score: 0.5, fuzzy: false };
  if (q.w.length >= 4 && q.w[0] === p.w[0]) {
    const limite = q.w.length >= 7 ? 2 : 1;
    // Também compara com o começo da palavra do item: quem digita "amortec" com erro ainda acha "AMORTECEDOR".
    const inicio = p.w.length > q.w.length ? p.w.slice(0, q.w.length) : p.w;
    let d = Math.min(distanciaEdicao(q.w, p.w, limite), distanciaEdicao(q.w, inicio, limite));
    // Radical curto (VOLV/VOLK) engana: só compara radicais quando ambos são longos.
    if (q.stem.length >= 5 && p.stem.length >= 5) d = Math.min(d, distanciaEdicao(q.stem, p.stem, limite));
    d = Math.min(d, distanciaEdicao(q.fon, p.fon, limite));
    if (d <= limite) return { score: 0.45 - 0.1 * d, fuzzy: true };
  }
  return null;
}

interface Melhor extends Casamento {
  pos: number;
}

interface Avaliacao {
  score: number;
  parecido: boolean;
  faltando: number;
}

function avaliar(entry: IndexedEntry, consulta: Consulta[]): Avaliacao {
  let soma = 0;
  let faltando = 0;
  let fuzzy = false;
  const posicoes: number[] = [];
  const qualidades: number[] = [];
  let exatas = 0;
  for (const q of consulta) {
    let melhor: Melhor | null = null;
    for (let pos = 0; pos < entry.palavras.length; pos++) {
      const p = entry.palavras[pos]!;
      const c = casar(q, p);
      if (!c) continue;
      const score = c.score * p.peso;
      if (!melhor || score > melhor.score) melhor = { score, fuzzy: c.fuzzy, pos: pos < entry.nDescricao ? pos : -1 };
    }
    // Código: "1572" acha "001572"; com 3+ dígitos também acha por início do código.
    if (q.numerica) {
      const digitos = q.w.replace(/^0+/, '');
      const codigoScore = digitos && entry.codigoSemZeros === digitos ? 1.5
        : digitos.length >= 3 && entry.codigoSemZeros.startsWith(digitos) ? 0.85 : 0;
      if (codigoScore && (!melhor || codigoScore > melhor.score)) melhor = { score: codigoScore, fuzzy: false, pos: -1 };
    }
    if (!melhor) {
      faltando++;
      continue;
    }
    soma += melhor.score;
    qualidades.push(melhor.score);
    if (melhor.fuzzy) fuzzy = true;
    if (melhor.score >= 1) exatas++;
    posicoes.push(melhor.pos);
  }

  let score = soma;
  const nenhumFaltando = faltando === 0;
  // Bônus de posição valem pela qualidade do pior casamento: "ARO" dentro de "REPARO" não ganha o mesmo que "AROMATIZANTE".
  const qualidade = Math.min(1, ...qualidades);
  if (nenhumFaltando && posicoes.length && posicoes.every((p) => p >= 0)) {
    const emOrdem = posicoes.every((p, i) => i === 0 || p > posicoes[i - 1]!);
    const contigua = emOrdem && posicoes.every((p, i) => i === 0 || p === posicoes[i - 1]! + 1);
    if (contigua) score += 1.5 * qualidade;
    else if (emOrdem) score += 0.5 * qualidade;
    if (posicoes[0] === 0) score += 1 * qualidade;
    if (exatas === consulta.length && consulta.length === entry.nDescricao) score += 2;
  }
  score -= entry.nDescricao * 0.03;
  return { score, parecido: fuzzy, faltando };
}

const collator = new Intl.Collator('pt-BR');

function porRelevancia(a: CatalogHit, b: CatalogHit): number {
  return b.score - a.score || collator.compare(a.entry.descricao, b.entry.descricao);
}

export interface BuscaOpcoes {
  /** Filtro aplicado antes de pontuar (tipo do produto, tipo de serviço...). */
  filtro?: (entry: IndexedEntry) => boolean;
}

/** Itens que casam com o termo, do mais relevante ao menos. Termo vazio → lista vazia (quem chama lista pelo SQL). */
export function buscarNoIndice(indice: CatalogIndex, termo: string, opcoes: BuscaOpcoes = {}): CatalogHit[] {
  const consulta = consultaDe(termo);
  if (!consulta.length) return [];

  const exatos: CatalogHit[] = [];
  const tolerantes: CatalogHit[] = [];
  const parciais: CatalogHit[] = [];
  for (const entry of indice.entries) {
    if (opcoes.filtro && !opcoes.filtro(entry)) continue;
    const r = avaliar(entry, consulta);
    if (r.faltando === 0) (r.parecido ? tolerantes : exatos).push({ entry, score: r.score, parecido: r.parecido });
    else if (r.faltando === 1 && consulta.length >= 2) parciais.push({ entry, score: r.score * 0.6, parecido: true });
  }

  exatos.sort(porRelevancia);
  tolerantes.sort(porRelevancia);
  // Erro de digitação só entra depois dos exatos, e some quando já há resultado bom de sobra.
  const resultado = exatos.length >= SO_MOSTRA_PARECIDO_SE_EXATOS_MENOS_QUE ? exatos : [...exatos, ...tolerantes];
  if (resultado.length) return resultado;
  // Nada casou com todas as palavras: mostra os que casam com todas menos uma.
  return parciais.sort(porRelevancia).slice(0, 30);
}

/** Ordenação escolhida pela pessoa (clique no cabeçalho da tabela) — feita nos dados do próprio índice. */
export function ordenarHits(hits: CatalogHit[], sortBy: string | undefined, sortOrder: 'asc' | 'desc' | undefined): CatalogHit[] {
  if (!sortBy) return hits;
  const campo = (h: CatalogHit): string =>
    sortBy === 'codigo' ? h.entry.codigo : sortBy === 'categoria' ? h.entry.grupo : sortBy === 'tipo' ? h.entry.tipoTexto : h.entry.descricao;
  const fator = sortOrder === 'desc' ? -1 : 1;
  return [...hits].sort((a, b) => fator * collator.compare(campo(a), campo(b)));
}
