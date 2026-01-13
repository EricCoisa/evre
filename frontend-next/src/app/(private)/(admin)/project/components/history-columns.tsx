import { ProjectHistory } from "@/lib/actions/project/types";
import type { ColumnDef } from '@tanstack/react-table';
import { DataCell, TableHead } from '@/components/table-utils';

export function getHistoryColumns(t : (key: string) => string): ColumnDef<ProjectHistory>[] {
  return [
    {
      accessorKey: 'type',
      header: () => <TableHead>{t('type')}</TableHead>,
      cell: ({ row }) => {
        return (
          <DataCell>
            {row.getValue('type')}
          </DataCell>
        );
      }
    },
        {
      accessorKey: 'createdAt',
      header: () => <TableHead>{t('createdAt')}</TableHead>,
      cell: ({ row }) => {
        return (
          <DataCell>
            {row.getValue('createdAt')}
          </DataCell>
        );
      }
    }
  ];
}
