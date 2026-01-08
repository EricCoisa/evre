"use client";

import { Logging } from '@/lib/actions/logging/types';
import type { ColumnDef } from '@tanstack/react-table';
import { DataCell, DataCellModal, TableHead } from '@/components/table-utils';
import { Tree } from '@/components/tree';
import { formatDate } from '@/lib/utils';
import { Contact } from '@/lib/actions/contact/types';

export function getContactColumns(t: (key: string) => string): ColumnDef<Contact>[] {
  return [
    {
      accessorKey: 'name',
      header: () => <TableHead>{t('name') || 'Nome'}</TableHead>,
      cell: ({ row }) => <DataCell>{String(row.getValue('name'))}</DataCell>,
      meta: {
        mobileOrder: 1,
        mobileWidth: 'half',
      },
    },
    {
      accessorKey: 'email',
      header: () => <TableHead>{t('email') || 'Email'}</TableHead>,
      cell: ({ row }) => <DataCell>{String(row.getValue('email'))}</DataCell>,
      meta: {
        mobileOrder: 2,
        mobileWidth: 'half',
      },
    },
    {
      accessorKey: 'telefone',
      header: () => <TableHead>{t('telefone') || 'Telefone'}</TableHead>,
      cell: ({ row }) => <DataCell>{String(row.getValue('telefone'))}</DataCell>,
      meta: {
        mobileOrder: 3,
        mobileWidth: 'half',
      },
    },
    {
      accessorKey: 'text',
      header: () => <TableHead>{t('text') || 'Mensagem'}</TableHead>,
      cell: ({ row }) => <DataCell maxWidth={200}>{String(row.getValue('text'))}</DataCell>,
      meta: {
        mobileOrder: 4,
        mobileWidth: 'full',
      },
    },
    {
      accessorKey: 'createdAt',
      header: () => <TableHead>{t('createdAt') || 'Criado em'}</TableHead>,
      cell: ({ row }) => <DataCell>{formatDate(row.getValue('createdAt'))}</DataCell>,
      meta: {
        mobileOrder: 5,
        mobileWidth: 'half',
      },
    },
  ];
}