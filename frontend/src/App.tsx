import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { bootstrapSession } from './api/httpClient.js';
import { ToastProvider } from './components/ui/ToastProvider.js';
import { useOfflineSync } from './hooks/useOfflineSync.js';
import { usePwaUpdate } from './hooks/usePwaUpdate.js';
import { useTheme } from './hooks/useTheme.js';
import { router } from './routes/router.js';
import { useAuthStore } from './store/authStore.js';
import { clearLegacyApiCache } from './pwa/apiCache.js';

/** Efeitos que dependem do ToastProvider (fila offline, atualização do PWA) — precisam estar por dentro dele. */
function AppEffects() {
  usePwaUpdate();
  useOfflineSync();
  return null;
}

export function App() {
  useTheme();
  const clearSession = useAuthStore((s) => s.clearSession);

  useEffect(() => {
    // Limpa dados de API persistidos pela versão antiga antes de restaurar a sessão.
    void clearLegacyApiCache()
      .catch(() => undefined)
      .then(() => bootstrapSession())
      .then((ok) => {
        if (!ok) clearSession();
      });
  }, [clearSession]);

  return (
    <ToastProvider>
      <AppEffects />
      <RouterProvider router={router} />
    </ToastProvider>
  );
}
