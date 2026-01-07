"use client";

import type { ColumnDef } from '@tanstack/react-table';
import type { Company } from '@/lib/actions/company/types';
import { Button } from '@/components/ui/button';
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil } from 'lucide-react';
import { DataCell, TableHead } from '@/components/table-utils';
import { Badge } from '@/components/ui/badge';

const statusColorMap: Record<string, string> = {
  DRAFT: 'bg-yellow-500',
  INVITED: 'bg-blue-500',
  ACTIVE: 'bg-green-500',
};

interface GetCompanyColumnsProps {
  t: (key: string) => string;
  onEdit: (company: Company) => void;
}

export function getCompanyColumns({ t, onEdit }: GetCompanyColumnsProps): ColumnDef<Company>[] {
  return [
    {
      accessorKey: 'name',
      header: () => <TableHead>{t('name') || 'Nome'}</TableHead>,
      cell: ({ row }) => <DataCell>{row.getValue('name')}</DataCell>,
      meta: {
        mobileOrder: 1,
        mobileWidth: 'half',
      },
    },
    {
      accessorKey: 'status',
      header: () => <TableHead>{t('status') || 'Status'}</TableHead>,
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        return (
          <DataCell>
            <Badge className={statusColorMap[status]}>
              {t(`status.${status.toLowerCase()}`) || status}
            </Badge>
          </DataCell>
        );
      },
      meta: {
        mobileOrder: 2,
        mobileWidth: 'half',
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
        mobileOrder: 4,
        mobileWidth: 'half',
        mobileLabel: t('createdAt'),
      },
    },
    {
      id: 'actions',
      header: () => <TableHead>{t('actions') || 'Ações'}</TableHead>,
      cell: ({ row }) => {
        const company = row.original;
        return (
          <DataCell>
            <div className="flex gap-2 items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(company)}
                title={t('editCompanyTooltip') || 'Editar empresa'}
                className="h-6 p-0 min-h-0"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          </DataCell>
        );
      },
      meta: {
        mobileOrder: 3,
        mobileWidth: 'half',
      },
    },
  ];
}
