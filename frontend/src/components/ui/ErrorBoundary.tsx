import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportClientError } from '../../utils/reportClientError.js';
import { ErrorScreen } from './ErrorScreen.js';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Rede de segurança contra erro de render — sem isso, um erro em qualquer componente
 * (ex.: acesso a propriedade de dado inesperado da API) estoura a árvore inteira e o
 * usuário vê tela branca. `componentDidCatch` só existe em class component, não tem
 * equivalente em hooks.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro não tratado na árvore de componentes:', error, info.componentStack);
    reportClientError('boundary', error, info.componentStack ?? undefined);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorScreen error={this.state.error} />;
    }
    return this.props.children;
  }
}
