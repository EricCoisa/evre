"use client";

import type { ColumnDef } from '@tanstack/react-table';
import type { Proposal } from '@/lib/actions/proposal/types';
import { Button } from '@/components/ui/button';
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Send, Check, Trash } from 'lucide-react';
import { DataCell, TableHead } from '@/components/table-utils';
import { Badge } from '@/components/ui/badge';
import { ProposalStatusColors } from '@/lib/actions/proposal/types';

interface GetProposalColumnsProps {
  t: (key: string) => string;
  onView: (proposal: Proposal) => void;
  onSend?: (proposal: Proposal) => void;
  onApprove?: (proposal: Proposal) => void;
  onDelete?: (proposal: Proposal) => void;
}

export function getProposalColumns({
  t,
  onView,
  onSend,
  onApprove,
  onDelete
}: GetProposalColumnsProps): ColumnDef<Proposal>[] {
  return [
    {
      accessorKey: 'id',
      header: () => <TableHead>{t('id') || 'ID'}</TableHead>,
      cell: ({ row }) => (
        <DataCell>
          {row.getValue<string>('id').substring(0, 8)}...
        </DataCell>
      ),
      meta: {
        mobileOrder: 1,
        mobileWidth: 'half',
      },
    },
    {
      accessorKey: 'name',
      header: () => <TableHead>{t('name') || 'Nome'}</TableHead>,
      cell: ({ row }) => (
        <DataCell>
          {row.getValue<string>('name')}
        </DataCell>
      ),
      meta: {
        mobileOrder: 2,
        mobileWidth: 'full',
      },
    },
    {
      accessorKey: 'companyId',
      header: () => <TableHead>{t('company') || 'Empresa'}</TableHead>,
      cell: ({ row }) => (
        <DataCell>
          {row.getValue<string>('companyId').substring(0, 8)}...
        </DataCell>
      ),
      meta: {
        mobileOrder: 3,
        mobileWidth: 'half',
      },
    },
    {
      accessorKey: 'status',
      header: () => <TableHead>{t('status') || 'Status'}</TableHead>,
      cell: ({ row }) => {
        const status = row.getValue<string>('status');
        return (
          <DataCell>
            <Badge className={ProposalStatusColors[status as keyof typeof ProposalStatusColors]}>
              {t(`status.${status.toLowerCase()}`) || status}
            </Badge>
          </DataCell>
        );
      },
      meta: {
        mobileOrder: 4,
        mobileWidth: 'half',
      },
    },
    {
      accessorKey: 'contentSchemaVersion',
      header: () => <TableHead>{t('version') || 'Versão'}</TableHead>,
      cell: ({ row }) => <DataCell>{row.getValue('contentSchemaVersion')}</DataCell>,
      meta: {
        mobileOrder: 5,
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
        mobileOrder: 6,
        mobileWidth: 'half',
        mobileLabel: t('createdAt'),
      },
    },
    {
      id: 'actions',
      header: () => <TableHead>{t('actions') || 'Ações'}</TableHead>,
      cell: ({ row }) => {
        const proposal = row.original;
        return (
          <DataCell>
            <div className="flex gap-2 items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onView(proposal)}
                title={t('viewProposalTooltip') || 'Ver proposta'}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete && onDelete(proposal)}
                title={t('deleteProposalTooltip') || 'Excluir proposta'}
              >
                <Trash className="h-4 w-4" />
              </Button>
              {proposal.status === 'DRAFT' && onSend && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSend(proposal)}
                  title={t('sendProposalTooltip') || 'Enviar proposta'}
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
              {proposal.status === 'SENT' && onApprove && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onApprove(proposal)}
                  title={t('approveProposalTooltip') || 'Aprovar proposta'}
                >
                  <Check className="h-4 w-4" />
                </Button>
              )}

            </div>
          </DataCell>
        );
      },
      meta: {
        mobileOrder: 7,
        mobileWidth: 'full',
      },
    },
  ];
}
