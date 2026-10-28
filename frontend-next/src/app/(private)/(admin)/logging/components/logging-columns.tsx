"use client";

import { Logging } from '@/lib/actions/logging/types';
import type { ColumnDef } from '@tanstack/react-table';
import { DataCell, DataCellModal, TableHead } from '@/components/table-utils';
import { Tree } from '@/components/tree';
import { formatDate } from '@/lib/utils';
import type { TFunc } from '@/hooks/use-translation';

export function getLoggingColumns(t: TFunc): ColumnDef<Logging>[] {
  return [
    {
      accessorKey: 'module',
      header: ()=> <TableHead>{t('module') || 'Módulo'}</TableHead>,
      cell: ({ row }) => <DataCell maxWidth={100}>{t(String(row.getValue('module')))}</DataCell>,
      meta: {
        mobileOrder: 1,
        mobileWidth: 'half',
      },
    },
    {
      accessorKey: 'action',
      header: () => <TableHead>{t('action') || 'Ação'}</TableHead>,
      cell: ({ row }) => <DataCell>{t(String(row.getValue('action')))}</DataCell>,
      meta: {
        mobileOrder: 2,
        mobileWidth: 'half',
      },
    },
    {
      accessorKey: 'message',
      header: () => <TableHead>{t('message') || 'Mensagem'}</TableHead>,
      cell: ({ row }) => <DataCell>{String(row.getValue('message'))}</DataCell>,
      meta: {
        mobileOrder: 3,
        mobileWidth: 'full',
      },
    },
    {
      accessorKey: 'performedBy',
      id: 'performedBy',
      header: () => <TableHead>{t('performedBy') || 'Executado por'}</TableHead>,
      cell: ({ row }) => {
        const pb = row.getValue('performedBy') as Logging['performedBy'];
        if (!pb) return <span className="text-muted-foreground">-</span>;
        return (
          <DataCell>
            <div className="flex flex-col text-sm">
              <span className="font-medium">{pb.name ?? pb.email}</span>
              <span className="text-xs text-muted-foreground">{pb.email}</span>
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
      accessorKey: 'metadata',
      header: () => <TableHead>{t('metadata')}</TableHead>,
       cell: ({ row }) => {
        const metadata = (row.getValue("metadata") ?? {}) as Record<string, unknown>;
        return (
          <DataCellModal
            title={t('metadata')}
            cellChildren={<Tree data={metadata} maxLines={2}/>}
            maxWidth={200}
          >
            <Tree data={metadata}/>
          </DataCellModal>
        );
       },
       meta: {
        mobileOrder: 5,
        mobileWidth: 'full',
      },
    },
    {
      accessorKey: 'createdAt',
      header: () => <TableHead>{t('createdAt') || 'Criado em'}</TableHead>,
      cell: ({ row }) => <DataCell>{formatDate(row.getValue('createdAt'))}</DataCell>,
      meta: {
        mobileOrder: 6,
        mobileWidth: 'half',
      },
    },
  ];
}