'use client';

import { useState, useCallback, Fragment } from 'react';
import { DataTable } from '@/components/data-table';
import { useUserRole } from '@/lib/actions/access/roleRouteAccess/queries';
import { getUserRoleColumns } from './roleRouteAccess-columns';
import type { RoleUser } from '@/lib/actions/access/roleRouteAccess/types';
import UserRoleAccess from './user-role-access';
import type { TFunc } from '@/hooks/use-translation';

export function UserRoleTab({ t }: { t: TFunc }) {
  const [viewingRoutesRole, setViewingRoutesRole] = useState<RoleUser | null>(null);
  const [isRoutesDialogOpen, setIsRoutesDialogOpen] = useState(false);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const { data: dataUserRole, error: errorUserRole } = useUserRole({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    pagination: true,
  });

  const handleViewRoutes = useCallback((role: RoleUser) => {
    setViewingRoutesRole(role);
    setIsRoutesDialogOpen(true);
  }, []);

  const columnsUserRole = getUserRoleColumns({ t, onViewRoutes: handleViewRoutes });

  return (
    <Fragment>
      <DataTable
        columns={columnsUserRole}
        data={dataUserRole}
        error={errorUserRole}
        queryKey={['userRoles', pagination]}
        pagination={pagination}
        onPaginationChange={setPagination}
        emptyMessage={t('noUserRoles')}
        entityName={t('entity') ?? 'userRole'}
        entityNamePlural={t('entityPlural') ?? 'userRoles'}
        enableGlobalFilter={true}
        searchPlaceholder={t('searchRoles')}
      />
      {viewingRoutesRole && (
        <UserRoleAccess
          role={viewingRoutesRole}
          open={isRoutesDialogOpen}
          onOpenChange={(open: boolean) => {
            setIsRoutesDialogOpen(open);
            if (!open) setViewingRoutesRole(null);
          }}
        />
      )}
    </Fragment>
  );
}
