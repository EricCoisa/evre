'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown, Eye } from 'lucide-react';
import { Project, ProjectStatusColors } from '@/lib/actions/project/types';
import { formatDate } from '@/lib/utils';
import { DataCell, TableHead } from '@/components/table-utils';
import Link from 'next/link';

interface GetProjectColumnsProps {
  t: (key: string) => string;
}

export function getProjectColumns({ t }: GetProjectColumnsProps): ColumnDef<Project>[] {
  return [
    {
      accessorKey: 'name',
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
                {t('name')}
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
      cell: ({ row }) => <DataCell><div className="font-medium">{row.getValue('name')}</div></DataCell>,
      enableSorting: true,
      meta: {
        mobileOrder: 1,
        mobileWidth: 'half',
      },
    },
    {
      accessorKey: 'status',
      header: () => <TableHead>{t('status')}</TableHead>,
      cell: ({ row }) => {
        const status = row.getValue('status') as keyof typeof ProjectStatusColors;
        return (
          <DataCell>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${ProjectStatusColors[status]}`}>
              {status}
            </span>
          </DataCell>
        );
      },
      meta: {
        mobileOrder: 2,
        mobileWidth: 'half',
      },
    },
    {
      accessorKey: 'description',
      header: () => <TableHead>{t('description')}</TableHead>,
      cell: ({ row }) => {
        const description = row.getValue('description') as string | null;
        return (
          <DataCell>
            <div className="max-w-md truncate">
              {description || '-'}
            </div>
          </DataCell>
        );
      },
      meta: {
        mobileOrder: 4,
        mobileWidth: 'full',
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
          {formatDate(row.getValue('createdAt'))}
        </DataCell>
      ),
      enableSorting: true,
      sortingFn: 'datetime',
      meta: {
        mobileOrder: 5,
        mobileWidth: 'half',
        mobileLabel: t('createdAt'),
      },
    },
    {
      id: 'actions',
      header: () => <TableHead>{t('actions')}</TableHead>,
      cell: ({ row }) => {
        const project = row.original;
        return (
          <DataCell>
            <div className="flex gap-2 items-center">
              <Link href={`/project/${project.id}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  title={t('viewProject') || 'Ver projeto'}
                  className="h-6 p-0 min-h-0"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </Link>
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
