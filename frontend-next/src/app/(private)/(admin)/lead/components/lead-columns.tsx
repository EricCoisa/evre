"use client";

import type { LeadDto } from '@/lib/actions/lead/types';
import type { LeadDtoStatus } from '@/lib/generated/schemas';
import type { ColumnDef } from '@tanstack/react-table';
import { DataCell, TableHead } from '@/components/table-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { TFunc } from '@/hooks/use-translation';
import { useTranslation } from '@/hooks/use-translation';
import { leadStatusLabelKey, LEAD_STATUS_BADGE_VARIANT, LEAD_STATUSES } from '@/lib/actions/lead/vocabulary';

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('vocabulary');
  const variant = LEAD_STATUS_BADGE_VARIANT[status as keyof typeof LEAD_STATUS_BADGE_VARIANT] ?? 'secondary';
  return <Badge variant={variant}>{t(leadStatusLabelKey(status))}</Badge>;
}

const STATUS_LABEL_KEY: Record<string, string> = {
  NEW: 'markAsNew',
  VIEWED: 'markAsViewed',
  RESOLVED: 'markAsResolved',
};

interface GetLeadColumnsProps {
  t: TFunc;
  onStatusChange: (lead: LeadDto, status: LeadDtoStatus) => void;
}

export function getLeadColumns({ t, onStatusChange }: GetLeadColumnsProps): ColumnDef<LeadDto>[] {
  return [
    {
      accessorKey: 'name',
      header: () => <TableHead>{t('name')}</TableHead>,
      cell: ({ row }) => <DataCell>{String(row.getValue('name'))}</DataCell>,
      meta: { mobileOrder: 1, mobileWidth: 'half' },
    },
    {
      accessorKey: 'phone',
      header: () => <TableHead>{t('phone')}</TableHead>,
      cell: ({ row }) => {
        const val = row.getValue('phone') as string | undefined;
        return <DataCell>{val ?? <span className="text-muted-foreground">-</span>}</DataCell>;
      },
      meta: { mobileOrder: 2, mobileWidth: 'half' },
    },
    {
      accessorKey: 'email',
      header: () => <TableHead>{t('email')}</TableHead>,
      cell: ({ row }) => {
        const val = row.getValue('email') as string | undefined;
        return <DataCell>{val ?? <span className="text-muted-foreground">-</span>}</DataCell>;
      },
      meta: { mobileOrder: 3, mobileWidth: 'full' },
    },
    {
      accessorKey: 'message',
      header: () => <TableHead>{t('message')}</TableHead>,
      cell: ({ row }) => <DataCell maxWidth={200}>{String(row.getValue('message'))}</DataCell>,
      meta: { mobileOrder: 4, mobileWidth: 'full' },
    },
    {
      accessorKey: 'status',
      header: () => <TableHead>{t('status')}</TableHead>,
      cell: ({ row }) => (
        <DataCell>
          <StatusBadge status={String(row.getValue('status'))} />
        </DataCell>
      ),
      meta: { mobileOrder: 5, mobileWidth: 'half' },
    },
    {
      accessorKey: 'createdAt',
      header: () => <TableHead>{t('createdAt')}</TableHead>,
      cell: ({ row }) => <DataCell>{formatDate(row.getValue('createdAt'))}</DataCell>,
      meta: { mobileOrder: 6, mobileWidth: 'half' },
    },
    {
      id: 'actions',
      header: () => <TableHead>{t('actions')}</TableHead>,
      cell: ({ row }) => {
        const lead = row.original;
        const otherStatuses = LEAD_STATUSES.filter((s) => s !== lead.status);
        return (
          <DataCell>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 p-0 min-h-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t('changeStatus')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {otherStatuses.map((status) => (
                  <DropdownMenuItem key={status} onClick={() => onStatusChange(lead, status)}>
                    {t(STATUS_LABEL_KEY[status])}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </DataCell>
        );
      },
      meta: { mobileOrder: 7, mobileWidth: 'half' },
    },
  ];
}
