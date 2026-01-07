"use client";

import { useState, useMemo, useCallback } from 'react';
import { useUserRoutesManagement, useGrantUserRouteAccess, useRevokeUserRouteAccess } from '@/lib/actions/user/queries';
import { DataTable } from '@/components/data-table';
import { getRouteManagementColumns } from './user-routeAccess-columns';
import { User } from '@/lib/actions/user/types';

interface UsersRolesPageProps {
  user: User;
}

export default function UsersRolesPage({ user }: UsersRolesPageProps) {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const queryParams = {
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    pagination: true,
  };

  const { data, error } = useUserRoutesManagement(user.id, queryParams);


  const grantAccess = useGrantUserRouteAccess();
  const revokeAccess = useRevokeUserRouteAccess();

  const handleToggleAccess = useCallback(async (routeId: string, hasAccess: boolean) => {
    try {
      if (hasAccess) {
        await revokeAccess.mutateAsync({ userId: user.id, routeId });
      } else {
        await grantAccess.mutateAsync({ userId: user.id, routeId });
      }
    } catch (error) {
      console.error('Erro ao alterar acesso:', error);
    }
  }, [user, grantAccess, revokeAccess]);

  const isLoading = grantAccess.isPending || revokeAccess.isPending;

  const columns = useMemo(() => getRouteManagementColumns({
    onToggleAccess: handleToggleAccess,
    isLoading,
  }), [handleToggleAccess, isLoading]);



  return (
          <DataTable
            columns={columns}
            data={data}
            error={error}
            queryKey={['users', user, 'routes-management', queryParams]}
            pagination={pagination}
            onPaginationChange={setPagination}
            loadingMessage="Carregando rotas..."
            emptyMessage="Nenhuma rota encontrada no sistema"
            entityName="rota"
            entityNamePlural="rotas"
            variant='default'
          />

  );
}