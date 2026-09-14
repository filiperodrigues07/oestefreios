import type { ReactNode } from 'react';

/**
 * Placeholder do shell da aplicação. Sidebar (desktop) e bottom navigation
 * (mobile) reais chegam na Fase 3 (Design System) do roadmap.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return <div style={{ minHeight: '100vh' }}>{children}</div>;
}
