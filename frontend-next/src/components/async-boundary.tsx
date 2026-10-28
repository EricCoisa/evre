'use client';

import { Component, Suspense, type ReactNode } from 'react';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { ErrorState } from '@/components/ui/error-state';
import { PanelSkeleton } from '@/components/panel-skeleton';

/** Boundary de loading, erro e retry para dados carregados via hooks de suspense do React Query. */

interface CatchProps {
  onReset: () => void;
  render?: (retry: () => void) => ReactNode;
  children: ReactNode;
}

class Catch extends Component<CatchProps, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  retry = () => {
    // reset() limpa o erro no cache; sem ele a query volta a falhar de imediato.
    this.props.onReset();
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return this.props.render
      ? this.props.render(this.retry)
      : <ErrorState message={error.message} onRetry={this.retry} />;
  }
}

export interface AsyncBoundaryProps {
  children: ReactNode;
  /** Skeleton exibido enquanto suspenso. Default: `PanelSkeleton`. */
  fallback?: ReactNode;
  /** UI de erro; recebe o `retry`, que depende do reset de cache interno ao boundary. */
  errorFallback?: (retry: () => void) => ReactNode;
}

export function AsyncBoundary({
  children,
  fallback = <PanelSkeleton />,
  errorFallback,
}: AsyncBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <Catch onReset={reset} render={errorFallback}>
          <Suspense fallback={fallback}>{children}</Suspense>
        </Catch>
      )}
    </QueryErrorResetBoundary>
  );
}
