"use client";
// TODO:DESATIVADO TEMPORARIAMENTE
import { UserRouteAccess } from '@/lib/actions/access/userRoute/types';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { TableHead } from '@/components/table-utils';

export function getUserRouteAccessColumns(t: (key: string) => string): ColumnDef<UserRouteAccess>[] {
  return [
    {
      accessorKey: 'user.email',
      header: () => <TableHead>{t('user') ?? 'User'}</TableHead>,
      cell: ({ row }) => {
        const user = row.original.user;
        return (
          <div className="flex flex-col">
            <span className="font-medium">{user?.email}</span>
            {user?.name && (
              <span className="text-sm text-muted-foreground">{user.name}</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'route.path',
      header: () => <TableHead>{t('route') ?? 'Route'}</TableHead>,
      cell: ({ row }) => {
        const route = row.original.route;
        return (
          <div className="flex flex-col">
            <Badge variant="outline" className="w-fit">
              {route?.path}
            </Badge>
            <span className="text-sm text-muted-foreground mt-1">
              {route?.labelKey ? t(route.labelKey) : '-'}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'grantedByUser',
      header: () => <TableHead>{t('grantedBy') ?? 'Granted By'}</TableHead>,
      cell: ({ row }) => {
        const grantedBy = row.original.grantedByUser;
        if (!grantedBy) {
          return <span className="text-muted-foreground">-</span>;
        }
        return (
          <div className="flex flex-col">
            <span className="text-sm">{grantedBy.email}</span>
            {grantedBy.name && (
              <span className="text-xs text-muted-foreground">{grantedBy.name}</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: () => <TableHead>{t('createdAt') ?? 'Created At'}</TableHead>,
      cell: ({ row }) => {
        return (
          <span className="text-sm text-muted-foreground">
            {format(new Date(row.original.createdAt), 'dd/MM/yyyy HH:mm')}
          </span>
        );
      },
    },
  ];
}