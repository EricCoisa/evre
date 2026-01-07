"use client";

import { useState, useMemo, useCallback } from 'react';
import { useUserRoleAccess, useGrantRoleRouteAccess, useRevokeRoleRouteAccess } from '@/lib/actions/access/roleRouteAccess/queries';
import { DataTable } from '@/components/data-table';
import { getRoleRouteManagementColumns } from './role-route-management-columns';


import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/hooks/use-translation';
import { RoleUser } from '@/lib/actions/access/roleRouteAccess/types';

interface UserRoleAccessProps {
  role: RoleUser;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function UserRoleAccess({ role, open = false, onOpenChange }: UserRoleAccessProps) {
  const { t } = useTranslation('access');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const queryParams = {
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    pagination: true,
  };

  const { data, error } = useUserRoleAccess(role.roleId, queryParams);
  const grantAccess = useGrantRoleRouteAccess();
  const revokeAccess = useRevokeRoleRouteAccess();

  const handleToggleAccess = useCallback(async (routeId: string, hasAccess: boolean) => {
    try {
      if (hasAccess) {
        await revokeAccess.mutateAsync({ roleId: role.roleId, routeId });
      } else {
        await grantAccess.mutateAsync({ roleId: role.roleId, routeId });
      }
    } catch (error) {
      console.error('Erro ao alterar acesso:', error);
    }
  }, [role.roleId, grantAccess, revokeAccess]);

  const isLoading = grantAccess.isPending || revokeAccess.isPending;
  
  const columns = useMemo(() => getRoleRouteManagementColumns({
    t,
    onToggleAccess: handleToggleAccess,
    isLoading,
  }), [handleToggleAccess, isLoading, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Rotas do Perfil {role.roleId}</DialogTitle>
          <DialogDescription>
            Gerencie as rotas de acesso para o perfil {role.roleId}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <DataTable
            columns={columns}
            data={data}
            error={error}
            queryKey={['roleRouteAccess', role.roleId, queryParams]}
            pagination={pagination}
            onPaginationChange={setPagination}
            loadingMessage="Carregando rotas..."
            emptyMessage="Nenhuma rota encontrada no sistema"
            entityName="rota"
            entityNamePlural="rotas"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
