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
import { AlignLeft, Mail, MessageCircle, MoreHorizontal, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { TFunc } from '@/hooks/use-translation';
import { useTranslation } from '@/hooks/use-translation';
import { leadStatusLabelKey, LEAD_STATUS_BADGE_VARIANT, LEAD_STATUSES } from '@/lib/actions/lead/vocabulary';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RichTextViewer } from '@/components/project/rich-text-viewer';

function MessageButton({ message, label }: { message: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        title={label}
        aria-label={label}
        onClick={() => setOpen(true)}
      >
        <AlignLeft className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <RichTextViewer content={message} />
        </DialogContent>
      </Dialog>
    </>
  );
}

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
  onDelete: (lead: LeadDto) => void;
  onOpenChat?: (lead: LeadDto) => void;
  chatEnabled?: boolean;
  chatOperational?: boolean;
  chatDisabledReason?: string;
  onSendEmail?: (lead: LeadDto) => void;
  emailEnabled?: boolean;
  emailOperational?: boolean;
  emailDisabledReason?: string;
}

export function getLeadColumns({
  t,
  onStatusChange,
  onDelete,
  onOpenChat,
  chatEnabled,
  chatOperational,
  chatDisabledReason,
  onSendEmail,
  emailEnabled,
  emailOperational,
  emailDisabledReason,
}: GetLeadColumnsProps): ColumnDef<LeadDto>[] {
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
          <DataCell className="flex gap-2 items-center">
            <MessageButton message={lead.message} label={t('message')} />
            {chatEnabled && onOpenChat && (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                title={chatOperational ? t('openChat') : (chatDisabledReason ?? t('providerUnavailable'))}
                aria-label={t('openChatWith', { name: lead.name ?? lead.phone ?? '' })}
                disabled={!chatOperational || !lead.phone}
                onClick={() => onOpenChat(lead)}
              >
                <MessageCircle className="size-4" />
              </Button>
            )}
            {emailEnabled && onSendEmail && (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                title={emailOperational ? t('sendEmail') : (emailDisabledReason ?? t('providerUnavailable'))}
                aria-label={t('sendEmailTo', { name: lead.name ?? lead.email ?? '' })}
                disabled={!emailOperational || !lead.email}
                onClick={() => onSendEmail(lead)}
              >
                <Mail className="size-4" />
              </Button>
            )}
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
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(lead)}
                >
                  <Trash2 className="size-4 mr-2" />
                  {t('delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </DataCell>
        );
      },
      meta: { mobileOrder: 7, mobileWidth: 'half' },
    },
  ];
}
