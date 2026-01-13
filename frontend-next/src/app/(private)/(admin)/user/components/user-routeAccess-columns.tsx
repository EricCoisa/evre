import type { ColumnDef } from '@tanstack/react-table';
import type { RouteWithUserAccess } from '@/lib/actions/user/types';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { memo } from 'react';
import { DataCell, TableHead } from '@/components/table-utils';

interface AccessToggleProps {
  route: RouteWithUserAccess;
  onToggle: (routeId: string, hasAccess: boolean) => Promise<void>;
  isLoading: boolean;
}

const AccessToggle = memo(function AccessToggle({ route, onToggle, isLoading }: AccessToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={route.hasAccess}
        onCheckedChange={(checked) => onToggle(route.id, !checked)}
        disabled={isLoading}
      />
    </div>
  );
});

interface GetRouteManagementColumnsProps {
  onToggleAccess: (routeId: string, hasAccess: boolean) => Promise<void>;
  isLoading: boolean;
}

export function getRouteManagementColumns({ onToggleAccess, isLoading }: GetRouteManagementColumnsProps): ColumnDef<RouteWithUserAccess>[] {
  return [
    {
      accessorKey: 'path',
      header: () => <TableHead>Caminho</TableHead>,
      cell: ({ row }) => (
        <DataCell>
          <code className="text-sm bg-muted px-2 py-1 rounded">
            {row.original.path}
          </code>
        </DataCell>
      ),
      meta: {
        mobileOrder: 1,
        mobileWidth: 'half',
      },
    },
    {
      accessorKey: 'labelKey',
      header: () => <TableHead>Nome</TableHead>,
      cell: ({ row }) => <DataCell>{row.original.labelKey}</DataCell>,
      meta: {
        mobileOrder: 2,
        mobileWidth: 'half',
      },
    },
    {
      accessorKey: 'isActive',
      header: () => <TableHead>Status da Rota</TableHead>,
      cell: ({ row }) => (
        <DataCell>
          <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
            {row.original.isActive ? 'Ativa' : 'Inativa'}
          </Badge>
        </DataCell>
      ),
      meta: {
        mobileOrder: 3,
        mobileWidth: 'half',
      },
    },
    {
      accessorKey: 'hasAccess',
      header: () => <TableHead>Acesso</TableHead>,
      cell: ({ row }) => {
        const route = row.original;

        return (
          <DataCell>
            <AccessToggle
              route={route}
              onToggle={onToggleAccess}
              isLoading={isLoading}
            />
          </DataCell>
        );
      },
      meta: {
        mobileOrder: 4,
        mobileWidth: 'half',
      },
    },
    {
      accessorKey: 'accessInfo',
      header: () => <TableHead>Concedido em</TableHead>,
      cell: ({ row }) => {
        const accessInfo = row.original.accessInfo;
        if (!accessInfo) return '-';

        const date = new Date(accessInfo.createdAt);
        return <DataCell>{date.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}</DataCell>;
      },
      meta: {
        mobileOrder: 5,
        mobileWidth: 'full',
      },
    },
  ];
}