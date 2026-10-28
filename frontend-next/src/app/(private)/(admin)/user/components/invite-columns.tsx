"use client";

import type { ColumnDef } from '@tanstack/react-table';
import type { Invite } from '@/lib/actions/user/types';
import { Button } from '@/components/ui/button';
import { Link2, Mail, Trash2 } from 'lucide-react';
import { DataCell, TableHead } from '@/components/table-utils';
import { RoleBadge } from '@/components/role-badge';
import type { TFunc } from '@/hooks/use-translation';

export function getInviteStatus(invite: Invite): 'PENDING' | 'USED' | 'EXPIRED' {
  if (invite.usedAt) return 'USED';
  if (new Date(invite.expiresAt) < new Date()) return 'EXPIRED';
  return 'PENDING';
}

const statusStyles = {
  PENDING: 'bg-green-100 text-green-800',
  USED: 'bg-gray-100 text-gray-600',
  EXPIRED: 'bg-orange-100 text-orange-700',
};

interface GetInviteColumnsProps {
  t: TFunc;
  onResend: (invite: Invite) => void;
  onDelete: (invite: Invite) => void;
  onShowLink: (invite: Invite) => void;
  emailOperational?: boolean;
}

export function getInviteColumns({ t, onResend, onDelete, onShowLink, emailOperational = true }: GetInviteColumnsProps): ColumnDef<Invite>[] {
  return [
    {
      accessorKey: 'email',
      header: () => <TableHead>{t('email')}</TableHead>,
      cell: ({ row }) => <DataCell>{row.getValue('email')}</DataCell>,
      meta: { mobileOrder: 1, mobileWidth: 'full' },
    },
    {
      accessorKey: 'roleName',
      header: () => <TableHead>{t('role')}</TableHead>,
      cell: ({ row }) => {
        const roleName = row.getValue('roleName') as string;
        return <DataCell><RoleBadge role={roleName}>{roleName}</RoleBadge></DataCell>;
      },
      meta: { mobileOrder: 2, mobileWidth: 'half' },
    },
    {
      id: 'status',
      header: () => <TableHead>{t('inviteStatus')}</TableHead>,
      cell: ({ row }) => {
        const status = getInviteStatus(row.original);
        const labels: Record<string, string> = {
          PENDING: t('inviteStatusPending'),
          USED: t('inviteStatusUsed'),
          EXPIRED: t('inviteStatusExpired'),
        };
        return (
          <DataCell>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[status]}`}>
              {labels[status]}
            </span>
          </DataCell>
        );
      },
      meta: { mobileOrder: 3, mobileWidth: 'half' },
    },
    {
      accessorKey: 'createdAt',
      header: () => <TableHead>{t('createdAt')}</TableHead>,
      cell: ({ row }) => (
        <DataCell>{new Date(row.getValue('createdAt')).toLocaleDateString('pt-BR')}</DataCell>
      ),
      meta: { mobileOrder: 4, mobileWidth: 'half' },
    },
    {
      accessorKey: 'expiresAt',
      header: () => <TableHead>{t('inviteExpiresAt')}</TableHead>,
      cell: ({ row }) => (
        <DataCell>{new Date(row.getValue('expiresAt')).toLocaleDateString('pt-BR')}</DataCell>
      ),
      meta: { mobileOrder: 5, mobileWidth: 'half' },
    },
    {
      id: 'actions',
      header: () => <TableHead>{t('actions')}</TableHead>,
      cell: ({ row }) => {
        const invite = row.original;
        const status = getInviteStatus(invite);
        return (
          <DataCell>
            <div className="flex gap-2 items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onShowLink(invite)}
                title={t('inviteLinkTooltip')}
                className="h-6 p-0 min-h-0"
                disabled={status === 'USED'}
              >
                <Link2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onResend(invite)}
                title={t('resendInviteTooltip')}
                className="h-6 p-0 min-h-0"
                disabled={status === 'USED' || !emailOperational}
              >
                <Mail className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(invite)}
                title={t('deleteInviteTooltip')}
                className="h-6 p-0 min-h-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </DataCell>
        );
      },
      meta: { mobileOrder: 6, mobileWidth: 'half' },
    },
  ];
}
