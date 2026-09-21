import { useEffect } from 'react';
import { useRouteError } from 'react-router';
import { ErrorScreen } from '../components/ui/ErrorScreen.js';

export function RouteErrorPage() {
  const error = useRouteError();
  useEffect(() => {
    console.error('Falha ao abrir página:', error);
  }, [error]);
  return <ErrorScreen error={error} />;
}
