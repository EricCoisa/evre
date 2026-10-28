'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { MessagingContact } from '@/lib/actions/messaging/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ContactAvatar } from '@/components/messaging/contact-avatar';
import { cn } from '@/lib/cn';
import { contactDisplayName } from '@/lib/messaging/contact';
import { MessageCircle, Pencil } from 'lucide-react';
import { DataCell, TableHead } from '@/components/table-utils';
import { format } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';
import type { TFunc } from '@/hooks/use-translation';

/** Mesmas cores dos status de usuário (verde = ok, vermelho = impedido). */
const SENDING_ALLOWED_STYLE = 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200';
const SENDING_BLOCKED_STYLE = 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';

interface GetMessagingContactsColumnsProps {
  t: TFunc;
  /** Rótulo da conexão do contato (provider + número); a coluna só aparece havendo mais de uma. */
  connectionLabel?: (connectionId: string) => string;
  locale?: string;
  onEdit: (contact: MessagingContact) => void;
  onOpenChat: (contact: MessagingContact) => void;
  chatEnabled: boolean;
  /** `false` quando a capability MESSAGING não está operacional (sem conexão configurada/respondendo). */
  chatOperational: boolean;
  chatDisabledReason?: string;
}

export function getMessagingContactsColumns({
  t,
  connectionLabel,
  locale,
  onEdit,
  onOpenChat,
  chatEnabled,
  chatOperational,
  chatDisabledReason,
}: GetMessagingContactsColumnsProps): ColumnDef<MessagingContact>[] {
  const dateLocale = locale?.startsWith('pt') ? ptBR : enUS;

  const columns: ColumnDef<MessagingContact>[] = [
    {
      id: 'photo',
      header: () => <TableHead>{t('photo')}</TableHead>,
      cell: ({ row }) => (
        <DataCell>
          <ContactAvatar
            contactId={row.original.id}
            name={row.original.name || row.original.pushName}
            hasProfilePicture={row.original.hasProfilePicture}
            className="size-9"
          />
        </DataCell>
      ),
      meta: {
        mobileOrder: 0,
        mobileWidth: 'half',
      },
    },
    {
      accessorKey: 'name',
      header: () => <TableHead>{t('contact')}</TableHead>,
      cell: ({ row }) => (
        <DataCell>
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{contactDisplayName(row.original)}</span>
            {/* Mesma pessoa em mais de uma conexão: o seletor de conversa (Fase 4) escolhe qual abrir. */}
            {row.original.conversationCount > 1 && (
              <Badge variant="secondary" className="shrink-0">
                {t('conversationCount', { count: row.original.conversationCount })}
              </Badge>
            )}
          </div>
          <div className="truncate font-mono text-xs text-muted-foreground">
            {row.original.phone}
          </div>
        </DataCell>
      ),
      meta: {
        mobileOrder: 1,
        mobileWidth: 'half',
      },
    },
    ...(connectionLabel
      ? [
          {
            id: 'connection',
            header: () => <TableHead>{t('connection')}</TableHead>,
            cell: ({ row }) => (
              <DataCell className="truncate">
                {connectionLabel(row.original.lastConnectionId)}
              </DataCell>
            ),
            meta: { mobileOrder: 2, mobileWidth: 'half' as const },
          } satisfies ColumnDef<MessagingContact>,
        ]
      : []),
    {
      accessorKey: 'lastMessageAt',
      header: () => <TableHead>{t('lastActivity')}</TableHead>,
      cell: ({ row }) => (
        <DataCell>
          {row.original.lastMessageAt
            ? format(new Date(row.original.lastMessageAt), 'PPp', { locale: dateLocale })
            : t('noActivity')}
        </DataCell>
      ),
      meta: {
        mobileOrder: 2,
        mobileWidth: 'half',
      },
    },
    {
      accessorKey: 'optOut',
      header: () => <TableHead>{t('optOut')}</TableHead>,
      cell: ({ row }) => (
        <DataCell>
          <Badge
            className={cn(
              'border-transparent',
              row.original.optOut ? SENDING_BLOCKED_STYLE : SENDING_ALLOWED_STYLE,
            )}
          >
            {row.original.optOut ? t('optedOut') : t('active')}
          </Badge>
        </DataCell>
      ),
      meta: {
        mobileOrder: 3,
        mobileWidth: 'full',
      },
    },
    {
      id: 'actions',
      header: () => <TableHead className="text-right">{t('actions')}</TableHead>,
      cell: ({ row }) => (
        <DataCell className="flex gap-2 items-center">
          {chatEnabled && (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              title={chatOperational ? t('openChat') : (chatDisabledReason ?? t('providerUnavailable'))}
              aria-label={t('openChatWith', {
                name: row.original.name || row.original.pushName || row.original.phone,
              })}
              disabled={!chatOperational}
              onClick={() => onOpenChat(row.original)}
            >
              <MessageCircle className="size-4" />
            </Button>
          )}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            title={t('editContact')}
            aria-label={t('editContactWith', {
              name: contactDisplayName(row.original),
            })}
            onClick={() => onEdit(row.original)}
          >
            <Pencil className="size-4" />
          </Button>
        </DataCell>
      ),
      meta: {
        mobileOrder: 4,
        mobileWidth: 'full',
      },
    },
  ];

  // A busca e o filtro são do servidor (nome, pushName e telefone). O DataTable ainda aplicaria um
  // `includesString` no cliente sobre as colunas com valor string — só `name`, muitas vezes nulo —
  // e esconderia de volta o contato que o servidor achou por telefone ou pushName.
  return columns.map((column) => ({ ...column, enableGlobalFilter: false }));
}
