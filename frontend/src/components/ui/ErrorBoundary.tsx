import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './Button.js';
import { ErrorState } from './ErrorState.js';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Rede de segurança contra erro de render — sem isso, um erro em qualquer componente
 * (ex.: acesso a propriedade de dado inesperado da API) estoura a árvore inteira e o
 * usuário vê tela branca. `componentDidCatch` só existe em class component, não tem
 * equivalente em hooks.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro não tratado na árvore de componentes:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          title="Algo deu errado"
          description="Ocorreu um erro inesperado nesta página. Recarregue para continuar."
          action={<Button onClick={() => window.location.reload()}>Recarregar página</Button>}
        />
      );
    }
    return this.props.children;
  }
}
