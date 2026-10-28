'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { flashHashTarget } from '@/lib/hash-target';
import type { OnChangeFn } from '@tanstack/react-table';
import { UserPlus } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { SwitchField } from '@/components/switch-field';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/use-translation';
import {
  useMessagingConnections,
  useMessagingContacts,
  messagingContactsKey,
  useCreateMessagingContact,
  useUpdateMessagingContact,
} from '@/lib/actions/messaging/queries';
import type { MessagingContact } from '@/lib/actions/messaging/types';
import { useChatWindows } from '@/components/messaging/chat-windows-provider';
import { useCapability } from '@/lib/actions/capability/queries';
import { CAPABILITIES } from '@/types/capabilities';
import { connectionDisplayName } from '@/lib/messaging/connection';
import { DataTable } from '@/components/data-table';
import { PhoneInput, isValidPhone } from '@/components/ui/phone-input';
import { buildTableQueryParams } from '@/lib/table-query-params';
import { getMessagingContactsColumns } from './messaging-contacts-columns';

export function MessagingContacts() {
  const { t, locale } = useTranslation('messaging');
  const { chatEnabled, openChatForPhone } = useChatWindows();
  const { disabled: messagingDisabled, reason: messagingDisabledReason } = useCapability(
    CAPABILITIES.messaging,
  );
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [globalFilter, setGlobalFilter] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const { data: connections = [] } = useMessagingConnections();
  const multipleConnections = connections.length > 1;
  const connectionOptions = useMemo(
    () => connections.map((item) => ({ value: item.id, label: connectionDisplayName(item) })),
    [connections],
  );

  // Buscar ou filtrar a partir da página 3 deixaria a lista vazia: o resultado novo tem menos páginas.
  const backToFirstPage = () => setPagination((current) => ({ ...current, pageIndex: 0 }));
  const changeSearch: OnChangeFn<string> = (value) => {
    setGlobalFilter(value);
    backToFirstPage();
  };
  const changeFilters: React.Dispatch<React.SetStateAction<Record<string, string>>> = (value) => {
    setFilters(value);
    backToFirstPage();
  };
  const [editing, setEditing] = useState<MessagingContact | null>(null);
  const [name, setName] = useState('');
  const [optOut, setOptOut] = useState(false);
  const [creatingContact, setCreatingContact] = useState(false);
  const [newPhone, setNewPhone] = useState('');

  useEffect(() => {
    flashHashTarget();
    window.addEventListener('hashchange', flashHashTarget);
    return () => window.removeEventListener('hashchange', flashHashTarget);
  }, []);

  const handleEdit = useCallback((contact: MessagingContact) => {
    setEditing(contact);
    setName(contact.name ?? '');
    setOptOut(contact.optOut);
  }, []);

  const handleOpenChat = useCallback(
    (contact: MessagingContact) => {
      openChatForPhone(contact.phone, { name: contact.name, pushName: contact.pushName });
    },
    [openChatForPhone],
  );

  const create = useCreateMessagingContact();

  const submitNewContact = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // O provider identifica o contato por dígitos puros; o componente emite E.164 com '+'.
    const phone = newPhone.replace(/\D/g, '');
    if (!isValidPhone(newPhone)) return;
    create.mutate(
      { phone },
      {
        onSuccess: () => {
          setCreatingContact(false);
          setNewPhone('');
        },
      },
    );
  };

  const { connectionId, ...columnFilters } = filters;
  const tableParams = buildTableQueryParams(pagination, globalFilter, columnFilters);
  const queryParams = {
    ...tableParams,
    ...(connectionId && { connectionId }),
  };
  const { data, error, isLoading } = useMessagingContacts(queryParams);
  const update = useUpdateMessagingContact();

  const columns = useMemo(
    () =>
      getMessagingContactsColumns({
        t,
        connectionLabel: multipleConnections
          ? (id) => {
              const found = connections.find((item) => item.id === id);
              return found ? connectionDisplayName(found) : '—';
            }
          : undefined,
        locale,
        onEdit: handleEdit,
        onOpenChat: handleOpenChat,
        chatEnabled,
        chatOperational: !messagingDisabled,
        chatDisabledReason: messagingDisabledReason,
      }),
    [
      t,
      locale,
      handleEdit,
      handleOpenChat,
      chatEnabled,
      messagingDisabled,
      messagingDisabledReason,
      multipleConnections,
      connections,
    ],
  );

  const saveContact = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    update.mutate(
      {
        contactId: editing.id,
        payload: { name: name.trim() || null, optOut },
      },
      { onSuccess: () => setEditing(null) },
    );
  };

  return (
    <>
        <DataTable
          columns={columns}
          data={data}
          error={error}
          queryKey={[...messagingContactsKey(queryParams)]}
          isLoading={isLoading}
          pagination={pagination}
          onPaginationChange={setPagination}
          globalFilter={globalFilter}
          onGlobalFilterChange={changeSearch}
          filters={filters}
          onFiltersChange={changeFilters}
          enableGlobalFilter
          searchPlaceholder={t('searchContacts')}
          emptyMessage={t('emptyContacts')}
          entityName={t('contact')}
          entityNamePlural={t('contact')}
        >
          <DataTable.Input
            title={t('searchContacts')}
            placeholder={t('searchContacts')}
          />
          {multipleConnections && (
            <DataTable.Select
              title={t('connection')}
              accessorKey="connectionId"
              placeholder={t('connection')}
              options={connectionOptions}
            />
          )}
          <DataTable.Select
            title={t('optOut')}
            accessorKey="optOut"
            placeholder={t('optOut')}
          />
          <DataTable.Actions className="sm:justify-end sm:w-full">
            <Button id="btn-new-contact" type="button" onClick={() => setCreatingContact(true)}>
              <UserPlus /> {t('newContact')}
            </Button>
          </DataTable.Actions>
        </DataTable>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editContact')}</DialogTitle>
            <DialogDescription>{editing?.phone}</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveContact} className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="messaging-contact-name">{t('contactName')}</Label>
              <Input
                id="messaging-contact-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
              />
            </div>
            <SwitchField
              id="messaging-contact-opt-out"
              label={t('blockSending')}
              description={t('optOutDescription')}
              checked={optOut}
              onCheckedChange={setOptOut}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {t('saveContact')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={creatingContact} onOpenChange={setCreatingContact}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('newContact')}</DialogTitle>
            <DialogDescription>{t('newContactDescription')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitNewContact} className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="messaging-new-contact-phone">{t('phoneNumber')}</Label>
              <PhoneInput
                id="messaging-new-contact-phone"
                value={newPhone}
                onChange={setNewPhone}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreatingContact(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={!isValidPhone(newPhone) || create.isPending}>
                {t('createContact')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}