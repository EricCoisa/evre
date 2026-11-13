'use client';

import { useState, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from "@/hooks/use-translation";
import { useCompanyContacts, useCreateCompanyContact, useArchiveCompanyContact } from "@/lib/actions/company/queries";
import { useQuery } from '@tanstack/react-query';
import { listMessagingContacts } from "@/lib/actions/messaging/api";
import { DataTable } from "@/components/data-table";
import { getCompanyContactColumns } from "./company-contact-columns";
import Modal from "@/components/modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CompanyContactEdit } from "./company-contact-edit";
import type { Contact } from "@/lib/actions/company/types";
import type { MessagingContact } from "@/lib/actions/messaging/types";
import { z } from "zod";
import { isValidPhone, PhoneInput } from "@/components/ui/phone-input";
import { Alive } from "@/lib/api/collector";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Plus } from 'lucide-react';

interface CompanyContactsTabProps {
  companyId: string;
}

type CreateMode = 'phone' | 'existing';

function ContactCreateModal({ companyId, open, onOpenChange }: {
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('company');
  const [mode, setMode] = useState<CreateMode>('phone');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: contactsData } = useQuery({
    queryKey: ['messaging', 'contacts', 'picker', searchQuery],
    queryFn: () => listMessagingContacts({ search: searchQuery || undefined, limit: 20 }),
    enabled: mode === 'existing',
    select: (r) => r.success ? r.data : undefined,
  });

  const { data: existingContacts } = useCompanyContacts(companyId);
  const linkedMcIds = useMemo(
    () => new Set(existingContacts?.map(c => c.messagingContactId) ?? []),
    [existingContacts],
  );

  const createContactMutation = useCreateCompanyContact(companyId);

  const schema = useMemo(() => z.object({
    phone: z.string().min(1, t('contacts.phoneRequired')).refine(isValidPhone, t('contacts.phoneInvalid')),
    name: z.string().optional(),
    role: z.string().optional(),
    email: z.string().email(t('contacts.emailInvalid')).optional().or(z.literal('')),
    isPrimary: z.boolean().optional().default(false),
    isDecisionMaker: z.boolean().optional().default(false),
    notes: z.string().optional(),
  }), [t]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { phone: '', name: '', role: '', email: '', isPrimary: false, isDecisionMaker: false, notes: '' },
  });

  function handleSelectContact(c: MessagingContact) {
    form.setValue('phone', `+${c.phone}`, { shouldValidate: true });
    if (c.name) form.setValue('name', c.name);
    setMode('phone');
    setSearchQuery('');
  }

  async function onSubmit(data: z.infer<typeof schema>) {
    try {
      await Alive(() => createContactMutation.mutateAsync({
        ...data,
        phone: data.phone.replace(/\D/g, ''),
      }))();
      onOpenChange(false);
    } catch {
      // toast já exibido pelo Alive
    }
  }

  function handleOpenChange(open: boolean) {
    onOpenChange(open);
    if (!open) {
      form.reset();
      setMode('phone');
      setSearchQuery('');
    }
  }

  return (
    <Modal open={open} onOpenChange={handleOpenChange} title={t('contacts.createNew')} description={t('contacts.createDescription')} size="md">
      <div className="flex gap-2 mb-4">
        <Button variant={mode === 'phone' ? 'default' : 'outline'} size="sm" type="button" onClick={() => setMode('phone')}>
          {t('contacts.modePhone')}
        </Button>
        <Button variant={mode === 'existing' ? 'default' : 'outline'} size="sm" type="button" onClick={() => setMode('existing')}>
          {t('contacts.modeExisting')}
        </Button>
      </div>

      {mode === 'existing' ? (
        <div className="space-y-2">
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('contacts.searchContactPlaceholder')}
            autoFocus
          />
          <div className="max-h-60 overflow-y-auto rounded-md border divide-y">
            {(() => {
              const results = contactsData?.data?.filter(c => !linkedMcIds.has(c.id)) ?? [];
              return results.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">{t('contacts.searchContactEmpty')}</p>
              ) : results.map(c => (
                <button key={c.id} type="button" className="w-full text-left px-3 py-2 hover:bg-accent text-sm" onClick={() => handleSelectContact(c)}>
                  <span className="font-medium">{c.name ?? c.phone}</span>
                  {c.name && <span className="ml-2 text-muted-foreground text-xs">{c.phone}</span>}
                </button>
              ));
            })()}
          </div>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('contacts.phone')}</FormLabel>
                <FormControl>
                  <PhoneInput value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('contacts.name')}</FormLabel>
                <FormControl><Input {...field} placeholder={t('contacts.namePlaceholder')} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="role" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('contacts.role')}</FormLabel>
                <FormControl><Input {...field} placeholder={t('contacts.rolePlaceholder')} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('contacts.email')}</FormLabel>
                <FormControl><Input {...field} type="email" placeholder={t('contacts.emailPlaceholder')} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex gap-6">
              <FormField control={form.control} name="isPrimary" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="font-normal">{t('contacts.isPrimary')}</FormLabel>
                </FormItem>
              )} />
              <FormField control={form.control} name="isDecisionMaker" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="font-normal">{t('contacts.isDecisionMaker')}</FormLabel>
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('notes')}</FormLabel>
                <FormControl><Textarea {...field} placeholder={t('notesPlaceholder')} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
              {form.formState.isSubmitting ? <Loader2 className="animate-spin size-4" /> : t('create')}
            </Button>
          </form>
        </Form>
      )}
    </Modal>
  );
}

export function CompanyContactsTab({ companyId }: CompanyContactsTabProps) {
  const { t } = useTranslation('company');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 });
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [archivingContact, setArchivingContact] = useState<Contact | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const handleEdit = useCallback((item: Contact) => {
    setEditingContact(item);
    setIsEditDialogOpen(true);
  }, []);

  const handleArchive = useCallback((item: Contact) => {
    setArchivingContact(item);
  }, []);

  const { data, error } = useCompanyContacts(companyId);
  const archiveContactMutation = useArchiveCompanyContact(companyId);

  const columns = useMemo(() =>
    getCompanyContactColumns({ t, onEdit: handleEdit, onArchive: handleArchive }),
    [t, handleEdit, handleArchive]
  );

  const contactDisplayName = (c: Contact) =>
    c.messagingContact.name ?? c.messagingContact.phone;

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        error={error}
        queryKey={['company', companyId, 'contacts']}
        pagination={pagination}
        onPaginationChange={setPagination}
        emptyMessage={t('contacts.empty')}
        entityName={t('contacts.entity')}
        entityNamePlural={t('contacts.entityPlural')}
      >
        <DataTable.Actions className="sm:justify-end sm:w-full">
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus /> {t('contacts.new')}
          </Button>
        </DataTable.Actions>
      </DataTable>

      <ContactCreateModal
        companyId={companyId}
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      <Modal
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setEditingContact(null);
        }}
        title={editingContact ? `${t('edit')} ${contactDisplayName(editingContact)}` : t('edit')}
        description={t('editDescription')}
      >
        <CompanyContactEdit
          companyId={companyId}
          contact={editingContact}
          onCancel={() => {
            setIsEditDialogOpen(false);
            setEditingContact(null);
          }}
          onSuccess={() => {
            setIsEditDialogOpen(false);
            setEditingContact(null);
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!archivingContact}
        onOpenChange={(open) => !open && setArchivingContact(null)}
        title={t('archiveConfirm')}
        description={archivingContact ? `${t('archiveConfirmDescription')} "${contactDisplayName(archivingContact)}"?` : ''}
        confirmLabel={t('archive')}
        confirmVariant="destructive"
        onConfirm={async () => {
          if (!archivingContact) return;
          await Alive(() => archiveContactMutation.mutateAsync(archivingContact.id))();
          setArchivingContact(null);
        }}
      />
    </>
  );
}
