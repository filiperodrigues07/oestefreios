import type { ReactNode } from 'react';
import { ErrorScreen } from './ErrorScreen.js';

interface ErrorStateProps {
  error?: unknown;
  title?: string;
  description?: string;
  action?: ReactNode;
}

export function ErrorState(props: ErrorStateProps) {
  return <ErrorScreen {...props} fullPage={false} />;
}
