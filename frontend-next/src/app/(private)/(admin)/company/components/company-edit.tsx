"use client";
import { FormBuilder, type FormBuilderField } from "@/components/form/form-builder";
import { useUpdateCompany } from "@/lib/actions/company/queries";
import { Company } from "@/lib/actions/company/types";
import { Alive } from "@/lib/api/collector";
import { useTranslation } from "@/hooks/use-translation";
import { useScreenItem } from "@/components/agent/screen-registry";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { z } from 'zod';

interface CompanyEditProps {
    company: Company | null;
    onCancel?: () => void;
    onSuccess?: () => void;
}

export function CompanyEdit({ company, onCancel, onSuccess }: CompanyEditProps) {
    const { t } = useTranslation('company');
    const queryClient = useQueryClient();
    const updateCompanyMutation = useUpdateCompany();
    // Diz ao agente qual registro está aberto na tela (ver screen-registry).
    useScreenItem('record', 'companies', company?.id);

    const updateCompanySchema = useMemo(() =>
        z.object({
            name: z.string().min(1, t('nameRequired')),
            tradeName: z.string().optional(),
            taxId: z.string().optional(),
            site: z.string().optional(),
            segment: z.string().optional(),
            notes: z.string().optional(),
        }),
    [t]);

    const companyFields = useMemo<FormBuilderField[]>(() => [
        { name: 'name', label: t('name'), placeholder: t('namePlaceholder') },
        { name: 'tradeName', label: t('tradeName'), placeholder: t('tradeNamePlaceholder') },
        { name: 'taxId', label: t('taxId'), placeholder: t('taxIdPlaceholder') },
        { name: 'site', label: t('site'), placeholder: t('sitePlaceholder') },
        { name: 'segment', label: t('segment'), placeholder: t('segmentPlaceholder') },
        { name: 'notes', label: t('notes'), type: 'textarea', placeholder: t('notesPlaceholder') },
    ], [t]);

    if (!company) return null;

    return (
        <FormBuilder
            key={company.id}
            schema={updateCompanySchema}
            fields={companyFields}
            mode="edit"
            values={{
                name: company.name,
                tradeName: company.tradeName ?? undefined,
                taxId: company.taxId ?? undefined,
                site: company.site ?? undefined,
                segment: company.segment ?? undefined,
                notes: company.notes ?? undefined,
            }}
            onCancel={onCancel}
            onSubmit={async (data) => {
                const result = await Alive(() => updateCompanyMutation.mutateAsync({ id: company.id, data }))();
                return result;
            }}
            onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['companies'] });
                onSuccess?.();
            }}
            submitLabel={t('save')}
            cancelLabel={t('cancel')}
        />
    )
}
