"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Send, CheckCircle, Archive } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { ContractDocument } from "@/lib/actions/contract-document/types";
import { ContractStatusColors } from "@/lib/actions/contract-document/types";
import { DataCell, TableHead } from "@/components/table-utils";


interface GetContractDocumentColumnsProps {
  t: (key: string) => string;
  onView: (contract: ContractDocument) => void;
  onSend?: (contract: ContractDocument) => void;
  onAccept?: (contract: ContractDocument) => void;
  onArchive?: (contract: ContractDocument) => void;
}

export function getContractDocumentColumns({
  t,
  onView,
  onSend,
  onAccept,
  onArchive,
}: GetContractDocumentColumnsProps): ColumnDef<ContractDocument>[] {
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
      accessorKey: 'version',
      header: () => <TableHead>{t('version') || 'Versão'}</TableHead>,
      cell: ({ row }) => (
        <DataCell>
          v{row.getValue<number>('version')}
        </DataCell>
      ),
      meta: {
        mobileOrder: 3,
        mobileWidth: 'half',
      },
    },
    {
      accessorKey: 'projectId',
      header: () => <TableHead>{t('project') || 'Projeto'}</TableHead>,
      cell: ({ row }) => (
        <DataCell>
          {row.getValue<string>('projectId').substring(0, 8)}...
        </DataCell>
      ),
      meta: {
        mobileOrder: 4,
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
            <Badge className={ContractStatusColors[status as keyof typeof ContractStatusColors]}>
              {t(`${status.toLowerCase()}`) || status}
            </Badge>
          </DataCell>
        );
      },
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
                onClick={() => column.toggleSorting(isSorted === 'asc')}
                className="hover:bg-muted"
              >
                {t('createdAt') || 'Criado em'}
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
        const contract = row.original;
        return (
          <DataCell>
            <div className="flex gap-2 items-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onView(contract)}
                title={t('view') || 'Visualizar'}
              >
                <Eye className="h-4 w-4" />
              </Button>
              {onSend && contract.status === 'DRAFT' && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onSend(contract)}
                  title={t('send') || 'Enviar'}
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
              {onAccept && contract.status === 'SENT' && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onAccept(contract)}
                  title={t('accept') || 'Aceitar'}
                >
                  <CheckCircle className="h-4 w-4" />
                </Button>
              )}
              {onArchive && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onArchive(contract)}
                  title={t('archive') || 'Arquivar'}
                >
                  <Archive className="h-4 w-4" />
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
