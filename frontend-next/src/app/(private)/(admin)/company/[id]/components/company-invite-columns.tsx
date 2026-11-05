"use client";

import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Link2, Mail, Trash2 } from 'lucide-react';
import { DataCell, TableHead } from '@/components/table-utils';
import type { TFunc } from '@/hooks/use-translation';

export interface CompanyInvite {
  id: string;
  email: string;
  roleId: string;
  roleName: string;
  createdByName: string | null;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  actionUrl?: string | null;
}

export function getInviteStatus(invite: CompanyInvite): 'PENDING' | 'EXPIRED' {
  if (new Date(invite.expiresAt) < new Date()) return 'EXPIRED';
  return 'PENDING';
}

const statusStyles: Record<string, string> = {
  PENDING: 'bg-green-100 text-green-800',
  EXPIRED: 'bg-orange-100 text-orange-700',
};

interface GetCompanyInviteColumnsProps {
  t: TFunc;
  onShowLink: (invite: CompanyInvite) => void;
  onResend: (invite: CompanyInvite) => void;
  onDelete: (invite: CompanyInvite) => void;
  emailOperational?: boolean;
}

export function getCompanyInviteColumns({ t, onShowLink, onResend, onDelete, emailOperational = true }: GetCompanyInviteColumnsProps): ColumnDef<CompanyInvite>[] {
  return [
    {
      accessorKey: 'email',
      header: () => <TableHead>{t('members.email')}</TableHead>,
      cell: ({ row }) => <DataCell>{row.getValue('email')}</DataCell>,
      meta: { mobileOrder: 1, mobileWidth: 'full' },
    },
    {
      id: 'status',
      header: () => <TableHead>{t('members.inviteStatus')}</TableHead>,
      cell: ({ row }) => {
        const status = getInviteStatus(row.original);
        const labels: Record<string, string> = {
          PENDING: t('members.inviteStatusPending'),
          EXPIRED: t('members.inviteStatusExpired'),
        };
        return (
          <DataCell>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[status]}`}>
              {labels[status]}
            </span>
          </DataCell>
        );
      },
      meta: { mobileOrder: 2, mobileWidth: 'half' },
    },
    {
      accessorKey: 'createdAt',
      header: () => <TableHead>{t('members.inviteCreatedAt')}</TableHead>,
      cell: ({ row }) => (
        <DataCell>{new Date(row.getValue('createdAt')).toLocaleDateString('pt-BR')}</DataCell>
      ),
      meta: { mobileOrder: 3, mobileWidth: 'half' },
    },
    {
      accessorKey: 'expiresAt',
      header: () => <TableHead>{t('members.inviteExpiresAt')}</TableHead>,
      cell: ({ row }) => (
        <DataCell>{new Date(row.getValue('expiresAt')).toLocaleDateString('pt-BR')}</DataCell>
      ),
      meta: { mobileOrder: 4, mobileWidth: 'half' },
    },
    {
      id: 'actions',
      header: () => <TableHead>{t('members.actions')}</TableHead>,
      cell: ({ row }) => {
        const invite = row.original;
        return (
          <DataCell>
            <div className="flex gap-2 items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onShowLink(invite)}
                title={invite.actionUrl ? t('members.inviteLinkTooltip') : t('members.inviteNoLinkHint')}
                className="h-6 p-0 min-h-0"
                disabled={!invite.actionUrl}
              >
                <Link2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onResend(invite)}
                title={t('members.resendInviteTooltip')}
                className="h-6 p-0 min-h-0"
                disabled={!emailOperational}
              >
                <Mail className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(invite)}
                title={t('members.deleteInviteTooltip')}
                className="h-6 p-0 min-h-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </DataCell>
        );
      },
      meta: { mobileOrder: 5, mobileWidth: 'half' },
    },
  ];
}
