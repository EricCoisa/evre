'use client';

import { Fragment } from 'react';
import { SortableRoutesTable } from './sortable-routes-table';
import { useRoutes } from '@/lib/actions/access/route/queries';
import { ErrorState } from '@/components/ui/error-state';
import { useQueryClient } from '@tanstack/react-query';
import type { TFunc } from '@/hooks/use-translation';

export function RoutesTab({ t }: { t: TFunc }) {
  const queryClient = useQueryClient();
  const { data: dataRoute, error: errorRoute, isLoading: isLoadingRoutes } = useRoutes({
    pagination: false,
  });

  return (
    <Fragment>
      {isLoadingRoutes ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          {t('loading')}
        </div>
      ) : errorRoute ? (
        <ErrorState onRetry={() => queryClient.refetchQueries({ queryKey: ['routes'] })} />
      ) : (
        <div className="flex-1">
          <SortableRoutesTable
            routes={Array.isArray(dataRoute) ? dataRoute : []}
            t={t}
          />
        </div>
      )}
    </Fragment>
  );
}
