"use client";

import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { RoleUser } from '@/lib/actions/access/roleRouteAccess/types';
import { Button } from '@/components/ui/button';
import { Route } from 'lucide-react';
import { DataCell, TableHead } from '@/components/table-utils';
import { userRoleColors } from '@/lib/actions/userConfiguration/types';

interface GetUserRoleProps {
  t: (key: string) => string;
  onViewRoutes: (user: RoleUser) => void;
}

export function getUserRoleColumns({ t, onViewRoutes }: GetUserRoleProps): ColumnDef<RoleUser>[] {
  return [
    {
      accessorKey: 'roleId',
      header: () => <TableHead>{t('user') ?? 'User'}</TableHead>,
      cell: ({ row }) => {
        const roleId = row.original.roleId;
        return (
          <DataCell>
            <Badge variant="outline" style={userRoleColors[roleId]}>
              {t(roleId)}
            </Badge>
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
              variant="ghost"
              size="sm"
              onClick={() => onViewRoutes(user)}
              title={t('viewRoutesTooltip') || 'Ver rotas'}
            >
              <Route className="h-4 w-4" />
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