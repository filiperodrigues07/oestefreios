import { getOS } from '../api/os.api.js';
import { queryClient } from '../api/queryClient.js';

/**
 * Importadores das páginas lazy — usados pelo router e pelo pré-carregamento. Mesmo import(), então
 * o navegador baixa cada chunk uma vez só, seja pelo clique ou pela intenção (hover/toque no menu).
 */
export const importOSFormPage = () => import('../pages/OSFormPage.js');
export const importOSListPage = () => import('../pages/OSListPage.js');
export const importClientesPage = () => import('../pages/ClientesPage.js');
export const importVeiculosPage = () => import('../pages/VeiculosPage.js');
export const importProdutosPage = () => import('../pages/ProdutosPage.js');
export const importRelatoriosPage = () => import('../pages/RelatoriosPage.js');
export const importUsuariosPage = () => import('../pages/UsuariosPage.js');
export const importConfiguracoesPage = () => import('../pages/ConfiguracoesPage.js');

const IMPORT_POR_ROTA: Record<string, () => Promise<unknown>> = {
  '/os': importOSListPage,
  '/clientes': importClientesPage,
  '/veiculos': importVeiculosPage,
  '/produtos': importProdutosPage,
  '/relatorios': importRelatoriosPage,
  '/usuarios': importUsuariosPage,
  '/configuracoes': importConfiguracoesPage,
};

/** Hover/toque/foco num item do menu: baixa o código da tela antes do clique. */
export function prefetchRoute(path: string): void {
  void IMPORT_POR_ROTA[path]?.().catch(() => undefined);
}

const OS_PREFETCH_STALE_MS = 30_000;

/**
 * Intenção de abrir uma OS (hover, toque, foco na linha): baixa o código da tela e os dados antes
 * do clique — a OS abre praticamente instantânea. Repetir é barato: o react-query deduplica e
 * respeita o staleTime, e o import() só baixa uma vez.
 */
export function prefetchOS(id: string): void {
  void importOSFormPage().catch(() => undefined);
  void queryClient.prefetchQuery({ queryKey: ['os', id], queryFn: () => getOS(id), staleTime: OS_PREFETCH_STALE_MS });
}
