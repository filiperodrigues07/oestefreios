import { QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './httpClient.js';
import { notifyToast } from '../components/ui/toastBus.js';

const AVISO_REPETIDO_MS = 2 * 60_000;
let ultimoAviso = { message: '', em: 0 };

export const queryClient = new QueryClient({
  // Rede de segurança pra falha de leitura (GET) que a página não trata explicitamente com
  // seu próprio `isError` — mutações já mostram toast próprio por página (ver `handleMutationError`),
  // então não repetimos aqui pra não duplicar aviso.
  queryCache: new QueryCache({
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : 'Não foi possível carregar os dados. Tente novamente.';
      // Listas com atualização automática falham juntas (ex.: CHERP fora do ar): um aviso só, não um a cada ciclo.
      const agora = Date.now();
      if (message === ultimoAviso.message && agora - ultimoAviso.em < AVISO_REPETIDO_MS) return;
      ultimoAviso = { message, em: agora };
      notifyToast(message, 'danger');
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Por padrão o TanStack Query PAUSA mutações quando navigator.onLine é falso, sem nem
      // chamar mutationFn — isso deixaria nossa fila offline (seção 26) sempre morta, porque
      // o apiFetch nunca seria invocado pra detectar a falha e enfileirar. 'always' garante que
      // a mutação tenta de verdade, e é o apiFetch (httpClient.ts) quem decide o que fazer com a falha.
      networkMode: 'always',
    },
  },
});
