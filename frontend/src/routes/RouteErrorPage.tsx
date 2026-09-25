import { useEffect } from 'react';
import { useRouteError } from 'react-router';
import { ErrorScreen } from '../components/ui/ErrorScreen.js';
import { reportClientError } from '../utils/reportClientError.js';

export function RouteErrorPage() {
  const error = useRouteError();
  useEffect(() => {
    console.error('Falha ao abrir página:', error);
    // 404/403 de rota é navegação normal, não bug — só erro de verdade vai pro log.
    const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : undefined;
    if (!status || status >= 500) reportClientError('route', error);
  }, [error]);
  return <ErrorScreen error={error} />;
}
