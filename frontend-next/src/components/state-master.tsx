
'use client';

import * as React from 'react';

import { useIsFetching, useIsMutating, useQueryClient } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { TableSkeleton } from './table-skeleton';
import { useTranslation } from '@/hooks/use-translation';

export interface StateMasterProps {
  queryKey: QueryKey;
  children: React.ReactNode;
  loadingMessage?: string;
  errorMessage?: string;
  useTableSkeleton?: boolean;
  skeletonRows?: number;
  skeletonColumns?: number;
  isLoading?: boolean; // Prop opcional para controle direto do loading
}

export function StateMaster({
  queryKey,
  children,
  loadingMessage,
  errorMessage,
  useTableSkeleton = false,
  skeletonRows = 5,
  skeletonColumns = 4,
  isLoading: isLoadingProp,
}: StateMasterProps) {
  const { t } = useTranslation('common');

  const queryClient = useQueryClient();
  // Detecção automática: usa apenas a primeira parte da queryKey para matching
  // Exemplo: ['users', params] -> verifica queries que começam com 'users'
  const queryKeyPrefix = Array.isArray(queryKey) && queryKey.length > 0 
    ? [queryKey[0]] 
    : queryKey;

  // Detecta erro da query pelo estado do queryClient
  const queryState = queryClient.getQueryState(queryKey);
  const error = queryState?.error;
  
  const isFetching = useIsFetching({ 
    queryKey: queryKeyPrefix,
    exact: false
  });
  
  const isMutating = useIsMutating({ 
    mutationKey: queryKeyPrefix,
    exact: false
  });

  // Prioriza o isLoading passado como prop, senão usa a detecção automática
  const isLoading = isLoadingProp ?? (isFetching > 0 || isMutating > 0);

  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 animate-in fade-in-50 duration-200">
        <div className="text-destructive">{errorMessage ?? 'Ocorreu um erro.'}</div>
        <pre className="text-xs text-muted-foreground max-w-md whitespace-pre-wrap">{String(error)}</pre>
        <button
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/80 transition"
           onClick={() => queryClient.refetchQueries({ queryKey: queryKeyPrefix })}
        >
          {t('tryAgain')}
        </button>
      </div>
    );
  }

  // Se estiver carregando e useTableSkeleton, renderiza apenas o skeleton
  if (isLoading && useTableSkeleton) {
    return <TableSkeleton rows={skeletonRows} columns={skeletonColumns} />;
  }

  // Caso contrário, renderiza children normalmente e overlay de loading se necessário
  return (
    <div className="relative animate-in fade-in-50 duration-200">
      <div style={{display: isLoading ? "none" : "unset"}}>
          {children}
      </div>
       {isLoading && (
        <div
          className="fixed left-0 top-0 flex items-center justify-center bg-background z-50 pointer-events-none"
          style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">{loadingMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}
