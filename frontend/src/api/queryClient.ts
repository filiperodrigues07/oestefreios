import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
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
