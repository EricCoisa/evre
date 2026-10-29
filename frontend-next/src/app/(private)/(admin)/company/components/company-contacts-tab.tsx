'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from "@/hooks/use-translation";
import { useCompanyContacts, useCreateCompanyContact, useArchiveCompanyContact } from "@/lib/actions/company/queries";
import { DataTable } from "@/components/data-table";
import { getCompanyContactColumns } from "./company-contact-columns";
import Modal from "@/components/modal";
import { FormBuilderModal, type FormBuilderField } from "@/components/form/form-builder";
import { CompanyContactEdit } from "./company-contact-edit";
import type { Contact } from "@/lib/actions/company/types";
import { z } from "zod";
import { Alive } from "@/lib/api/collector";
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface CompanyContactsTabProps {
  companyId: string;
}

export function CompanyContactsTab({ companyId }: CompanyContactsTabProps) {
  const { t } = useTranslation('company');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 });
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [archivingContact, setArchivingContact] = useState<Contact | null>(null);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const handleEdit = useCallback((item: Contact) => {
    setEditingContact(item);
    setIsEditDialogOpen(true);
  }, []);

  const handleArchive = useCallback((item: Contact) => {
    setArchivingContact(item);
    setIsArchiveDialogOpen(true);
  }, []);

  const { data, error } = useCompanyContacts(companyId);

  const createContactMutation = useCreateCompanyContact(companyId);
  const archiveContactMutation = useArchiveCompanyContact(companyId);

  const createContactSchema = useMemo(() =>
    z.object({
      name: z.string().min(1, t('nameRequired')),
      role: z.string().optional(),
      email: z.string().email(t('contacts.emailInvalid')).optional().or(z.literal('')),
      phone: z.string().optional(),
      isPrimary: z.boolean().optional().default(false),
      isDecisionMaker: z.boolean().optional().default(false),
      notes: z.string().optional(),
    }),
  [t]);

  const createContactFields = useMemo<FormBuilderField[]>(() => [
    { name: 'name', label: t('contacts.name'), placeholder: t('contacts.namePlaceholder') },
    { name: 'role', label: t('contacts.role'), placeholder: t('contacts.rolePlaceholder') },
    { name: 'email', label: t('contacts.email'), type: 'email', placeholder: t('contacts.emailPlaceholder') },
    { name: 'phone', label: t('contacts.phone'), placeholder: t('contacts.phonePlaceholder') },
    { name: 'isPrimary', label: t('contacts.isPrimary'), type: 'checkbox' },
    { name: 'isDecisionMaker', label: t('contacts.isDecisionMaker'), type: 'checkbox' },
    { name: 'notes', label: t('notes'), type: 'textarea', placeholder: t('notesPlaceholder') },
  ], [t]);

  const columns = useMemo(() =>
    getCompanyContactColumns({ t, onEdit: handleEdit, onArchive: handleArchive }),
    [t, handleEdit, handleArchive]
  );

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

      <FormBuilderModal
        size="md"
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        title={t('contacts.createNew')}
        description={t('contacts.createDescription')}
        schema={createContactSchema}
        fields={createContactFields}
        mode="create"
        onSubmit={async (data) => {
          const result = await Alive(() => createContactMutation.mutateAsync(data))();
          return result;
        }}
        onError={(error) => {
          console.error('Error creating contact:', error);
        }}
        submitLabel={t('create')}
      />

      <Modal
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setEditingContact(null);
        }}
        title={editingContact ? `${t('edit')} ${editingContact.name}` : t('edit')}
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

      <Modal
        open={isArchiveDialogOpen}
        onOpenChange={(open) => {
          setIsArchiveDialogOpen(open);
          if (!open) setArchivingContact(null);
        }}
        title={t('archiveConfirm')}
        description={archivingContact ? `${t('archiveConfirmDescription')} "${archivingContact.name}"?` : ''}
      >
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setIsArchiveDialogOpen(false);
              setArchivingContact(null);
            }}
          >
            {t('cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              if (!archivingContact) return;
              await Alive(() => archiveContactMutation.mutateAsync(archivingContact.id))();
              setIsArchiveDialogOpen(false);
              setArchivingContact(null);
            }}
          >
            {t('archive')}
          </Button>
        </div>
      </Modal>
    </>
  );
}
