"use client";

import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, UserX } from 'lucide-react';
import { DataCell, TableHead } from '@/components/table-utils';
import { Badge } from '@/components/ui/badge';
import { RoleBadge } from '@/components/role-badge';
import type { TFunc } from '@/hooks/use-translation';
import type { CompanyMember } from '@/lib/actions/company/types';

export type Member = CompanyMember;

interface GetMemberColumnsProps {
  t: TFunc;
  onEdit: (member: Member) => void;
  onDeactivate: (member: Member) => void;
  onRemove: (member: Member) => void;
  currentUserId?: string;
}

export function getMemberColumns({ t, onEdit, onDeactivate, onRemove, currentUserId }: GetMemberColumnsProps): ColumnDef<Member>[] {
  return [
    {
      accessorKey: 'user.name',
      header: () => <TableHead>{t('members.name')}</TableHead>,
      cell: ({ row }) => {
        const member = row.original;
        return (
          <DataCell>
            <div>
              <span className="font-medium">{member.user.name ?? member.user.email}</span>
              {member.user.name && (
                <span className="block text-xs text-muted-foreground">{member.user.email}</span>
              )}
            </div>
          </DataCell>
        );
      },
      meta: { mobileOrder: 1, mobileWidth: 'full' },
    },
    {
      id: 'roleName',
      header: () => <TableHead>{t('members.roleName')}</TableHead>,
      cell: ({ row }) => {
        const roleName = row.original.user.roleRecord?.name;
        if (!roleName) return <DataCell>—</DataCell>;
        return (
          <DataCell>
            <RoleBadge role={roleName}>{roleName}</RoleBadge>
          </DataCell>
        );
      },
      meta: { mobileOrder: 2, mobileWidth: 'half' },
    },
    {
      id: 'permissions',
      header: () => <TableHead>{t('members.permissions')}</TableHead>,
      cell: ({ row }) => {
        const member = row.original;
        return (
          <DataCell>
            <div className="flex flex-wrap gap-1">
              {member.canSeeCommercials && (
                <Badge variant="secondary" className="text-xs">{t('members.canSeeCommercials')}</Badge>
              )}
              {member.canComment && (
                <Badge variant="outline" className="text-xs">{t('members.canComment')}</Badge>
              )}
              {!member.canSeeCommercials && !member.canComment && (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
          </DataCell>
        );
      },
      meta: { mobileOrder: 3, mobileWidth: 'half' },
    },
    {
      accessorKey: 'createdAt',
      header: () => <TableHead>{t('members.since')}</TableHead>,
      cell: ({ row }) => (
        <DataCell>
          {new Date(row.getValue('createdAt')).toLocaleDateString('pt-BR')}
        </DataCell>
      ),
      meta: { mobileOrder: 4, mobileWidth: 'half' },
    },
    {
      id: 'actions',
      header: () => <TableHead>{t('members.actions')}</TableHead>,
      cell: ({ row }) => {
        const member = row.original;
        const isSelf = currentUserId === member.user.id;
        const isInactive = member.user.status === 'INACTIVE';
        const deactivateTitle = isSelf
          ? t('members.cannotDeactivateSelf')
          : isInactive
            ? t('members.alreadyInactive')
            : t('members.deactivateTooltip');
        return (
          <DataCell>
            <div className="flex gap-2 items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(member)}
                title={t('members.editTooltip')}
                className="h-6 p-0 min-h-0"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDeactivate(member)}
                disabled={isSelf || isInactive}
                title={deactivateTitle}
                className="h-6 p-0 min-h-0"
              >
                <UserX className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(member)}
                disabled={isSelf}
                title={isSelf ? t('members.cannotRemoveSelf') : t('members.removeTooltip')}
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
