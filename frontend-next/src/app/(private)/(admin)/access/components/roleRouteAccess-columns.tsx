"use client";

import type { ColumnDef } from '@tanstack/react-table';
import { RoleUser } from '@/lib/actions/access/roleRouteAccess/types';
import { Button } from '@/components/ui/button';
import { Route } from 'lucide-react';
import { DataCell, TableHead } from '@/components/table-utils';
import { RoleBadge } from '@/components/role-badge';
import type { TFunc } from '@/hooks/use-translation';

interface GetUserRoleProps {
  t: TFunc;
  onViewRoutes: (user: RoleUser) => void;
}

export function getUserRoleColumns({ t, onViewRoutes }: GetUserRoleProps): ColumnDef<RoleUser>[] {
  return [
    {
      accessorKey: 'roleName',
      header: () => <TableHead>{t('role') ?? 'Role'}</TableHead>,
      cell: ({ row }) => {
        const roleName = row.original.roleName;
        return (
          <DataCell>
            <RoleBadge role={roleName}>{t(roleName)}</RoleBadge>
          </DataCell>
        );
      },
      meta: {
        mobileOrder: 1,
        mobileWidth: 'half',
      },
    },
    {
      id: 'actions',
      header: () => <TableHead>{t('actions') || 'Ações'}</TableHead>,
      cell: ({ row }) => {
        const user = row.original;
        return (
          <DataCell>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewRoutes(user)}
              className="gap-2"
            >
              <Route className="h-4 w-4" />
              <span>{t('manageRoutes')}</span>
            </Button>
          </DataCell>
        );
      },
      meta: {
        mobileOrder: 2,
        mobileWidth: 'half',
      },
    },
  ];
}