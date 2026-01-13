"use client";
import { GenericCreateForm } from "@/components/generic-create-form";
import { updateCompany } from "@/lib/actions/company/api";
import { Company } from "@/lib/actions/company/types";
import { Alive } from "@/lib/api/collector";
import { FieldConfig } from "@/lib/form/field-config";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { z } from 'zod';

interface CompanyEditPageProps {
    company: Company | null;
    onCancel?: () => void;
}

export function CompanyEditPage({ company, onCancel }: CompanyEditPageProps) {
    const queryClient = useQueryClient();

    const updateCompanySchema = z.object({
        name: z.string().min(1, 'Nome é obrigatório').max(255, 'Nome muito longo').optional(),
    });

    const updateCompanyFieldConfig = useMemo(() => ({
        name: {
            label: 'Nome',
            placeholder: 'Nome da empresa',
            description: 'Nome da empresa',
        },
    } satisfies FieldConfig<typeof updateCompanySchema>), []);

    return (
        <GenericCreateForm
            key={company?.id || 'edit-form'}
            schema={updateCompanySchema}
            fieldConfig={updateCompanyFieldConfig}
            onCancel={onCancel}
            onSubmit={async (data) => {
                if (!company) return;
                const cleanData = Object.fromEntries(
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    Object.entries(data).filter(([_, v]) => v !== undefined)
                );
                const result = await Alive(() => updateCompany(company.id, cleanData))();
                return result;
            }}
            onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['companies'] });
            }}
            onError={(error) => {
                console.error('Erro ao atualizar empresa:', error);
            }}
            submitLabel="Atualizar Empresa"
            defaultValues={company ? {
                name: company.name || '',
            } : undefined}
        />
    );
}
