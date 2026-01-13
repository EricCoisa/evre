"use client";

import { ClientLog } from '@/lib/actions/clientLog/types';
import type { ColumnDef } from '@tanstack/react-table';
import { DataCell, DataCellModal, TableHead } from '@/components/table-utils';
import { Tree } from '@/components/tree';
import { formatDate } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

export function getClientLogColumns(t: (key: string) => string): ColumnDef<ClientLog>[] {
  return [
    {
      accessorKey: 'companyName',
      header: () => <TableHead>{t('company') || 'Empresa'}</TableHead>,
      cell: ({ row }) => <DataCell>{String(row.getValue('companyName'))}</DataCell>,
      meta: { mobileOrder: 1, mobileWidth: 'half' },
    },
    {
      accessorKey: 'projectName',
      header: () => <TableHead>{t('project') || 'Projeto'}</TableHead>,
      cell: ({ row }) => <DataCell>{String(row.getValue('projectName'))}</DataCell>,
      meta: { mobileOrder: 2, mobileWidth: 'half' },
    },
    {
      accessorKey: 'environment',
      header: () => <TableHead>{t('environment') || 'Ambiente'}</TableHead>,
      cell: ({ row }) => <DataCell>{String(row.getValue('environment'))}</DataCell>,
      meta: { mobileOrder: 3, mobileWidth: 'half' },
    },
    {
      accessorKey: 'metadata',
      header: () => <TableHead>{t('metadata')}</TableHead>,
       cell: ({ row }) => {
        const metadata = row.getValue("metadata");
        const parsedMetadata = metadata ? JSON.parse(String(metadata)) : {};
        console.log('parsedMetadata', parsedMetadata);
        let data =  {};
        try {
          data = JSON.parse(String(parsedMetadata.metadata))
        } catch (e) {}
        // Remove a propriedade 'metadata' de parsedMetadata
        const { metadata: _omit, ...parsedMetadataWithoutMetadata } = parsedMetadata || {};
        return (
          <DataCellModal
            title={t('metadata')}
            cellChildren={<Tree data={parsedMetadataWithoutMetadata} maxLines={2} />}
            maxWidth={200}
          >
            <div>
              <Tree data={parsedMetadataWithoutMetadata} />
              <Separator />
              <br />
              <Tree data={data} />
            </div>
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
      meta: { mobileOrder: 6, mobileWidth: 'half' },
    },
  ];
}