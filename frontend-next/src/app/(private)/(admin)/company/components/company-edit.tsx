"use client";
import { Container } from "@/components/container";
import { GenericCreateForm, GenericCreateFormModal } from "@/components/generic-create-form";
import { updateCompany } from "@/lib/actions/company/api";
import { Company } from "@/lib/actions/company/types";
import { Alive } from "@/lib/api/collector";
import { FieldConfig } from "@/lib/form/field-config";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from 'zod';
import { ProjectList } from "../../project/components/project-list";
import { Button } from "@/components/ui/button";
import { Copy, Plus } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { Input } from "@/components/ui/input";
import Modal from "@/components/modal";
import { createCompanyInvite } from "@/lib/actions/user/api";
import { toast } from "sonner";

interface CompanyEditPageProps {
    company: Company | null;
    onCancel?: () => void;
}

export function CompanyEditPage({ company, onCancel }: CompanyEditPageProps) {
    const queryClient = useQueryClient();
    const { t } = useTranslation('projects');

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

    const createInviteSchema = useMemo(() => z.object({
        companyId: z.string().min(1, t('companyRequired')),
        email: z.string().min(1, t('emailRequired')).email(t('emailInvalid')),
        name: z.string().optional()
    }), [t]);

    const userInviteFieldConfig = useMemo(() => ({
        companyId: {
            disabled: true
        },
        email: {
            label: t('email'),
            type: 'email' as const,
            placeholder: t('emailPlaceholder'),
            description: t('emailDescription'),
        },
        name: {
            label: t('name'),
            placeholder: t('namePlaceholder'),
            description: t('nameDescription'),
        },
        // companyId propositalmente omitido do config para não aparecer no formulário
    } satisfies FieldConfig<typeof createInviteSchema>), [t]);


    const [invitationToken, setInvitationToken] = useState<string | null>(null);
    const handleCloseInvitationModal = () => {
        setInvitationToken(null);
    }

    return (
        <>
            <ProjectList companyId={company?.id} showCompanyFilter={false} >
                <GenericCreateFormModal
                    trigger={
                        <Button>
                            <Plus /> {t('newInvite')}
                        </Button>
                    }
                    closeOnsuccess={true}
                    title={t('createNewInvite')}
                    description={t('createInviteDescription')}
                    schema={createInviteSchema}
                    fieldConfig={userInviteFieldConfig}
                    onSubmit={async (data) => {
                        const result = await Alive(() => createCompanyInvite(data))();
                        return result;
                    }}
                    onSuccess={(success) => {
                        setInvitationToken((success as { actionUrl: string }).actionUrl);
                    }}
                    onError={(error) => {
                        console.error('Erro ao criar usuário:', error);
                    }}
                    submitLabel={t('createInviteButton')}
                    defaultValues={{
                        companyId: company?.id,
                    }}
                />

                <GenericCreateFormModal
                    trigger={
                        <Button>
                            <Plus /> {t('editCompany')}
                        </Button>
                    }
                    closeOnsuccess={true}
                    title={t('editCompany')}
                    description={t('editCompanyDescription')}
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
            </ProjectList>
            {invitationToken && (
                <Modal
                    title={t('inviteTokenCreated')}
                    description={t('inviteTokenDescription')}
                    open={invitationToken !== null}
                    onOpenChange={(open) => {
                        if (!open) handleCloseInvitationModal();
                    }}
                >
                    <Container>
                        <div className="flex items-center gap-2">
                            <Input readOnly value={invitationToken ?? ''} />
                            <Button
                                onClick={async () => {
                                    try {
                                        await navigator.clipboard.writeText(invitationToken ?? '');
                                        toast.success('Token copiado');
                                    } catch (e) {
                                        toast.error('Falha ao copiar');
                                    }
                                }}
                            >
                                <Copy className="size-4 mr-2" /> Copiar
                            </Button>
                        </div>
                    </Container>
                </Modal>)}
        </>
    );
}
