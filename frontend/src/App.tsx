import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { bootstrapSession } from './api/httpClient.js';
import { ToastProvider } from './components/ui/ToastProvider.js';
import { useTheme } from './hooks/useTheme.js';
import { router } from './routes/router.js';
import { useAuthStore } from './store/authStore.js';

export function App() {
  useTheme();
  const clearSession = useAuthStore((s) => s.clearSession);

  useEffect(() => {
    bootstrapSession().then((ok) => {
      if (!ok) clearSession();
    });
  }, [clearSession]);

  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  );
}
