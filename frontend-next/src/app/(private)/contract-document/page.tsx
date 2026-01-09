'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';

import { getContractDocumentColumns } from './components/contract-document-columns';
import {
    useContractDocuments,
    useCreateContractDocument,
    useSendContractDocument,
    useAcceptContractDocument,
    useArchiveContractDocument,
} from '@/lib/actions/contract-document/queries';
import { useProjects } from '@/lib/actions/project/queries';
import { useProposals } from '@/lib/actions/proposal/queries';
import type { ContractDocument } from '@/lib/actions/contract-document/types';
import { FieldConfig } from '@/lib/form/field-config';
import { Container } from '@/components/container';
import { DataTable } from '@/components/data-table';

export default function ContractDocumentsPage() {
    const { t } = useTranslation('contract-document');
    const queryClient = useQueryClient();
    const router = useRouter();

    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
    const [globalFilter, setGlobalFilter] = useState('');
    const [filters, setFilters] = useState<Record<string, string>>({});

    const sendContractMutation = useSendContractDocument();
    const acceptContractMutation = useAcceptContractDocument();
    const archiveContractMutation = useArchiveContractDocument();

    // Busca todos os projetos para o select
    const { data: projectsData } = useProjects({ pagination: false });

    // Busca todas as propostas para o select
    const { data: proposalsData } = useProposals({ pagination: false });

    const projectOptions = useMemo(() => {
        if (!projectsData || Array.isArray(projectsData)) {
            const projects = Array.isArray(projectsData) ? projectsData : [];
            return projects.map((project) => ({
                value: project.id,
                label: project.name,
            }));
        }
        return [];
    }, [projectsData]);

    const proposalOptions = useMemo(() => {
        if (!proposalsData || Array.isArray(proposalsData)) {
            const proposals = Array.isArray(proposalsData) ? proposalsData : [];
            return proposals.map((proposal) => ({
                value: proposal.id,
                label: proposal.name,
            }));
        }
        return [];
    }, [proposalsData]);

    const handleView = useCallback(
        (contract: ContractDocument) => {
            router.push(`/contract-document/${contract.id}`);
        },
        [router],
    );

    const handleSend = useCallback(
        async (contract: ContractDocument) => {
            try {
                await sendContractMutation.mutateAsync(contract.id);
                toast.success(t('sendSuccess') || 'Contrato enviado com sucesso!');
            } catch (error) {
                toast.error(t('sendError') || 'Erro ao enviar contrato');
            }
        },
        [sendContractMutation, t],
    );

    const handleAccept = useCallback(
        async (contract: ContractDocument) => {
            try {
                await acceptContractMutation.mutateAsync(contract.id);
                toast.success(t('acceptSuccess') || 'Contrato aceito com sucesso!');
            } catch (error) {
                toast.error(t('acceptError') || 'Erro ao aceitar contrato');
            }
        },
        [acceptContractMutation, t],
    );

    const handleArchive = useCallback(
        async (contract: ContractDocument) => {
            try {
                await archiveContractMutation.mutateAsync(contract.id);
                toast.success(t('archiveSuccess') || 'Contrato arquivado com sucesso!');
            } catch (error) {
                toast.error(t('archiveError') || 'Erro ao arquivar contrato');
            }
        },
        [archiveContractMutation, t],
    );

    const queryParams = {
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        pagination: true,
        ...(globalFilter && { search: globalFilter }),
        ...(Object.keys(filters).length > 0 && { filter: JSON.stringify(filters) }),
    };

    const { data, error } = useContractDocuments(queryParams);

    const createContractSchema = useMemo(
        () =>
            z.object({
                projectId: z
                    .string()
                    .uuid(t('projectIdRequired') || 'ID do projeto inválido'),
                proposalId: z
                    .string()
                    .uuid(t('proposalIdInvalid') || 'ID da proposta inválido')
                    .optional(),
                name: z.string().min(1, t('nameRequired') || 'Nome obrigatório'),
                content: z.string().min(1, t('contentRequired') || 'Conteúdo obrigatório'),
                contentSchemaVersion: z.string().optional().default('v1'),
            }),
        [t],
    );

    const contractFieldConfig = useMemo(
        () =>
            ({
                projectId: {
                    label: t('projectId') || 'Projeto',
                    placeholder: t('projectIdPlaceholder') || 'Selecione um projeto',
                    description: t('projectIdDescription') || 'Projeto do contrato',
                    type: 'select' as const,
                    options: projectOptions,
                },
                proposalId: {
                    label: t('proposalId') || 'Proposta (opcional)',
                    placeholder: t('proposalIdPlaceholder') || 'Selecione uma proposta',
                    description:
                        t('proposalIdDescription') || 'Proposta relacionada ao contrato',
                    type: 'select' as const,
                    options: proposalOptions,
                },
                name: {
                    label: t('name') || 'Nome',
                    placeholder: t('namePlaceholder') || 'Digite o nome do contrato',
                    description: t('nameDescription') || 'Nome do contrato',
                },
                content: {
                    label: t('content') || 'Conteúdo',
                    placeholder: t('contentPlaceholder') || 'Digite o conteúdo JSON',
                    description:
                        t('contentDescription') || 'Conteúdo do contrato em formato JSON',
                    type: 'textarea' as const,
                },
                contentSchemaVersion: {
                    label: t('version') || 'Versão',
                    placeholder: t('versionPlaceholder') || 'v1',
                    description: t('versionDescription') || 'Versão do schema de conteúdo',
                },
            }) satisfies FieldConfig<typeof createContractSchema>,
        [t, projectOptions, proposalOptions],
    );

    const columns = useMemo(
        () =>
            getContractDocumentColumns({
                t,
                onView: handleView,
                onSend: handleSend,
                onAccept: handleAccept,
                onArchive: handleArchive,
            }),
        [t, handleView, handleSend, handleAccept, handleArchive],
    );

    if (error) {
        return (
            <Container>
                <div className="text-center py-8">
                    <p className="text-destructive">
                        {t('loadError') || 'Erro ao carregar contratos'}
                    </p>
                </div>
            </Container>
        );
    }

    return (
        <Container>
            <DataTable
                columns={columns}
                data={data}
                error={error}
                queryKey={['contract-document', queryParams]}
                pagination={pagination}
                onPaginationChange={setPagination}
                globalFilter={globalFilter}
                enableGlobalFilter={true}
                onGlobalFilterChange={setGlobalFilter}
                filters={filters}
                onFiltersChange={setFilters}
                searchPlaceholder={t('searchPlaceholder') ?? 'Buscar contratos...'}
                loadingMessage={t('loading') ?? 'Carregando...'}
                emptyMessage={t('noLogs') ?? 'Nenhum contrato encontrado'}
                entityName={t('entity') ?? 'contrato'}
                entityNamePlural={t('entityPlural') ?? 'contratos'}
            >
                {/* Área de Filtros e Configurações */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-4">
                    {/* Filtros à esquerda */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
                        <DataTable.Input
                            title={t('searchText')}
                            placeholder={t('searchPlaceholder')}
                        />
                    </div>

                </div>
            </DataTable>
        </Container>
    );
}
