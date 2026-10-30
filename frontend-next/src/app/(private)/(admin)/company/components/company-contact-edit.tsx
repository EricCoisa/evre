"use client";
import { FormBuilder, type FormBuilderField } from "@/components/form/form-builder";
import { Contact } from "@/lib/actions/company/types";
import { Alive } from "@/lib/api/collector";
import { useTranslation } from "@/hooks/use-translation";
import { useUpdateCompanyContact } from "@/lib/actions/company/queries";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { z } from 'zod';

interface CompanyContactEditProps {
    companyId: string;
    contact: Contact | null;
    onCancel?: () => void;
    onSuccess?: () => void;
}

export function CompanyContactEdit({ companyId, contact, onCancel, onSuccess }: CompanyContactEditProps) {
    const { t } = useTranslation('company');
    const queryClient = useQueryClient();
    const updateContactMutation = useUpdateCompanyContact(companyId);

    const updateContactSchema = useMemo(() =>
        z.object({
            role: z.string().optional(),
            email: z.string().email(t('contacts.emailInvalid')).optional().or(z.literal('')),
            isPrimary: z.boolean().optional(),
            isDecisionMaker: z.boolean().optional(),
            notes: z.string().optional(),
        }),
    [t]);

    const contactFields = useMemo<FormBuilderField[]>(() => [
        { name: 'role', label: t('contacts.role'), placeholder: t('contacts.rolePlaceholder') },
        { name: 'email', label: t('contacts.email'), type: 'email', placeholder: t('contacts.emailPlaceholder') },
        { name: 'isPrimary', label: t('contacts.isPrimary'), type: 'checkbox' },
        { name: 'isDecisionMaker', label: t('contacts.isDecisionMaker'), type: 'checkbox' },
        { name: 'notes', label: t('notes'), type: 'textarea', placeholder: t('notesPlaceholder') },
    ], [t]);

    if (!contact) return null;

    return (
        <FormBuilder
            key={contact.id}
            schema={updateContactSchema}
            fields={contactFields}
            mode="edit"
            values={{
                role: contact.role ?? undefined,
                email: contact.email ?? undefined,
                isPrimary: contact.isPrimary,
                isDecisionMaker: contact.isDecisionMaker,
                notes: contact.notes ?? undefined,
            }}
            onCancel={onCancel}
            onSubmit={async (data) => {
                const result = await Alive(() => updateContactMutation.mutateAsync({ contactId: contact.id, data }))();
                return result;
            }}
            onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['company', companyId, 'contacts'] });
                onSuccess?.();
            }}
            onError={(error) => {
                console.error('Error updating contact:', error);
            }}
            submitLabel={t('save')}
            cancelLabel={t('cancel')}
        />
    )
}
