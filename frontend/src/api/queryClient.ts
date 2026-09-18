import { QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './httpClient.js';
import { notifyToast } from '../components/ui/toastBus.js';

export const queryClient = new QueryClient({
  // Rede de segurança pra falha de leitura (GET) que a página não trata explicitamente com
  // seu próprio `isError` — mutações já mostram toast próprio por página (ver `handleMutationError`),
  // então não repetimos aqui pra não duplicar aviso.
  queryCache: new QueryCache({
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : 'Não foi possível carregar os dados. Tente novamente.';
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
