"use client";
import type { ColumnDef } from '@tanstack/react-table';
import type { RoleUserAccess } from '@/lib/actions/access/roleRouteAccess/types';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { memo } from 'react';
import { getIcon } from '@/lib/utils';
import { DataCell, TableHead } from '@/components/table-utils';

interface AccessToggleProps {
    routeAccess: RoleUserAccess;
    onToggle: (routeId: string, hasAccess: boolean) => Promise<void>;
    isLoading: boolean;
}

const AccessToggle = memo(function AccessToggle({ routeAccess, onToggle, isLoading }: AccessToggleProps) {
    return (
        <div className="flex items-center gap-2">
            <Switch
                checked={routeAccess.hasAccess}
                onCheckedChange={() => onToggle(routeAccess.routeId, routeAccess.hasAccess)}
                disabled={isLoading}
            />
        </div>
    );
});

interface GetRoleRouteManagementColumnsProps {
    t: (key: string) => string;
    onToggleAccess: (routeId: string, hasAccess: boolean) => Promise<void>;
    isLoading: boolean;
}

export function getRoleRouteManagementColumns({ t, onToggleAccess, isLoading }: GetRoleRouteManagementColumnsProps): ColumnDef<RoleUserAccess>[] {
    return [
        {
            accessorKey: 'path',
            header: () => <TableHead>Caminho</TableHead>,
            cell: ({ row }) => {
                const icon = row.original.icon;
                if (!icon) {
                    return (
                        <DataCell>
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                                {row.original.path}
                            </code>
                        </DataCell>
                    );
                }
                const Icon = getIcon(icon);
                return (
                    <DataCell>
                        <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                                {row.original.path}
                            </code>
                        </div>
                    </DataCell>
                );
            },
        },
        {
            accessorKey: 'labelKey',
            header: () => <TableHead>Nome</TableHead>,
            cell: ({ row }) =>
                <DataCell> {t(row.original.labelKey)}</DataCell>,
        },
        {
            id: 'hasAccess',
            header: () => <TableHead>Acesso</TableHead>,
            cell: ({ row }) => {
                const routeAccess = row.original;

                return (
                    <DataCell>
                        <AccessToggle
                            routeAccess={routeAccess}
                            onToggle={onToggleAccess}
                            isLoading={isLoading}
                        />
                    </DataCell>
                );
            },
        },
        {
            id: 'status',
            header: () => <TableHead>Status</TableHead>,
            cell: ({ row }) => {
                return (
                    <DataCell>
                        <Badge variant={row.original.hasAccess ? 'default' : 'secondary'}>
                            {row.original.hasAccess ? 'Com Acesso' : 'Sem Acesso'}
                        </Badge>
                    </DataCell>
                );
            },
        },
    ];
}
