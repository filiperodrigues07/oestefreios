import { buscarNoIndice, construirIndice, type BuscaOpcoes, type CatalogHit, type CatalogIndex, type CatalogItemInput } from '../utils/catalogEngine.js';
import { logger } from '../utils/logger.js';

const TTL_PADRAO_MS = 5 * 60_000;
/** Busca sem resultado só força recarga se o índice tiver mais que isso: produto recém-cadastrado no CHERP aparece rápido, sem martelar o banco. */
const RECARGA_MINIMA_MS = 60_000;

/**
 * Catálogo (produtos ou serviços) em memória para o motor de busca. Só texto e códigos — preço e saldo
 * são buscados no banco na hora, para nunca mostrar valor velho. Recarrega a cada 5 min sem travar quem busca
 * (devolve o índice atual enquanto o novo carrega) e uma recarga por vez, mesmo com várias buscas juntas.
 */
export class CatalogIndexCache {
  private indice: CatalogIndex | null = null;
  private carregando: Promise<CatalogIndex> | null = null;

  constructor(
    private readonly carregar: () => Promise<CatalogItemInput[]>,
    private readonly ttlMs = TTL_PADRAO_MS,
  ) {}

  async obter(): Promise<CatalogIndex> {
    if (!this.indice) return this.recarregar();
    if (Date.now() - this.indice.criadoEm > this.ttlMs) {
      void this.recarregar().catch((err: unknown) => logger.warn({ err }, 'Falha ao atualizar índice do catálogo; mantendo o anterior'));
    }
    return this.indice;
  }

  idadeMs(): number {
    return this.indice ? Date.now() - this.indice.criadoEm : Number.POSITIVE_INFINITY;
  }

  recarregar(): Promise<CatalogIndex> {
    if (!this.carregando) {
      this.carregando = this.carregar()
        .then((itens) => {
          this.indice = construirIndice(itens);
          return this.indice;
        })
        .finally(() => {
          this.carregando = null;
        });
    }
    return this.carregando;
  }

  invalidar(): void {
    this.indice = null;
  }
}

/** Busca ranqueada; se nada casar e o índice já está "velho", recarrega uma vez e tenta de novo. */
export async function buscarRanqueado(cache: CatalogIndexCache, termo: string, opcoes: BuscaOpcoes = {}): Promise<CatalogHit[]> {
  let hits = buscarNoIndice(await cache.obter(), termo, opcoes);
  if (hits.length === 0 && cache.idadeMs() > RECARGA_MINIMA_MS) {
    hits = buscarNoIndice(await cache.recarregar(), termo, opcoes);
  }
  return hits;
}
