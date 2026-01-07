"use client";

import type { ColumnDef } from '@tanstack/react-table';
import { UserStatusColors, type User } from '@/lib/actions/user/types';
import { Button } from '@/components/ui/button';
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Route } from 'lucide-react';
import { DataCell, TableHead } from '@/components/table-utils';
import { userRoleColors } from '@/lib/actions/userConfiguration/types';

interface GetUserColumnsProps {
  t: (key: string) => string;
  onEdit: (user: User) => void;
  onViewRoutes: (user: User) => void;
}

export function getUserColumns({ t, onEdit, onViewRoutes }: GetUserColumnsProps): ColumnDef<User>[] {
  return [
    {
      accessorKey: 'name',
      header: () => <TableHead>{t('name') || 'Nome'}</TableHead>,
      cell: ({ row }) => <DataCell>{row.getValue('name') || t('noName')}</DataCell>,
      meta: {
        mobileOrder: 1,
        mobileWidth: 'half',
      },
    },
    {
      accessorKey: 'email',
      header: () => <TableHead>{t('email') || 'Email'}</TableHead>,
      cell: ({ row }) => <DataCell>{row.getValue('email')}</DataCell>,
      meta: {
        mobileOrder: 3,
        mobileWidth: 'full',
      },
    },
    {
      accessorKey: 'role',
      header: () => <TableHead>{t('function') || 'Função'}</TableHead>,
      cell: ({ row }) => {
        const role = row.getValue('role') as string;

        const getRoleLabel = (role: string) => {
          const roleLabels = {
            ADMIN: t('roleAdmin') || 'Administrador',
            MODERATOR: t('roleModerator') || 'Moderador',
            USER: t('roleUser') || 'Usuário',
          };
          return roleLabels[role as keyof typeof roleLabels] || role;
        };

        return (
          <DataCell>
            <span className={`rounded-full px-3 py-1 text-xs font-medium`} style={userRoleColors[role]}>
              {getRoleLabel(role)}
            </span>
          </DataCell>
        );
      },
      meta: {
        mobileOrder: 4,
        mobileWidth: 'half', // Função e Status lado a lado no mobile
      },
    },
    {
      accessorKey: 'status',
      header: () => <TableHead>{t('status') || 'Status'}</TableHead>,
      cell: ({ row }) => {
        const status = row.getValue('status') as string;

        const getStatusLabel = (status: string) => {
          const statusLabels = {
            ACTIVE: t('statusActive') || 'Ativo',
            INACTIVE: t('statusInactive') || 'Inativo',
            SUSPENDED: t('statusSuspended') || 'Suspenso',
          };
          return statusLabels[status as keyof typeof statusLabels] || status;
        };

        return (
          <DataCell>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${UserStatusColors[status as keyof typeof UserStatusColors]}`}>
              {getStatusLabel(status)}
            </span>
          </DataCell>
        );
      },
      meta: {
        mobileOrder: 5,
        mobileWidth: 'half', // Função e Status lado a lado no mobile
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => {
        const isSorted = column.getIsSorted();
        return (
          <DataCell>
            <div className="text-center">
              <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                className="p-0 hover:bg-transparent justify-center font-medium"
              >
                {t('createdAt')}
                {isSorted === 'asc' ? (
                  <ArrowUp className="ml-2 h-4 w-4" />
                ) : isSorted === 'desc' ? (
                  <ArrowDown className="ml-2 h-4 w-4" />
                ) : (
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
              </Button>
            </div>
          </DataCell>
        );
      },
      cell: ({ row }) => (
        <DataCell>
          {new Date(row.getValue('createdAt')).toLocaleDateString('pt-BR')}
        </DataCell>
      ),
      enableSorting: true,
      sortingFn: 'datetime',
      meta: {
        mobileOrder: 6,
        mobileWidth: 'half',
        mobileLabel: t('createdAt'),
      },
    },
    {
      id: 'actions',
      header: () => <TableHead>{t('actions') || 'Ações'}</TableHead>,
      cell: ({ row }) => {
        const user = row.original;
        return (
          <DataCell>
            <div className="flex gap-2 items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewRoutes(user)}
                title={t('viewRoutesTooltip') || 'Ver rotas'}
                className="h-6 p-0 min-h-0"
              >
                <Route className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { onEdit(user) }}
                title={t('editUserTooltip') || 'Editar usuário'}
                className="h-6 p-0 min-h-0"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
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