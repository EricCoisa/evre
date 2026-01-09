'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import { Copy, Check, Sparkles } from 'lucide-react';

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
import { Button } from '@/components/ui/button';
import { GenericCreateFormModal } from '@/components/generic-create-form';
import Modal from '@/components/modal';
import { Textarea } from '@/components/ui/textarea';

export default function ContractDocumentsPage() {
    const { t } = useTranslation('contractDocument');
    const queryClient = useQueryClient();
    const router = useRouter();

    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
    const [globalFilter, setGlobalFilter] = useState('');
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [copied, setCopied] = useState(false);
    const [templateModalOpen, setTemplateModalOpen] = useState(false);

    const createContractMutation = useCreateContractDocument();
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

    const handleCopyTemplate = useCallback(() => {
        const template = {
            version: '1.0',
            components: [
                {
                    object: 'Title',
                    value: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS',
                    level: 1,
                },
                {
                    object: 'Container',
                    value: [
                        {
                            object: 'Title',
                            value: 'Partes Contratantes',
                            level: 3,
                        },
                        {
                            object: 'Party',
                            value: {
                                role: 'contractor',
                                name: 'Nome da Empresa Contratante',
                                document: 'CNPJ XX.XXX.XXX/XXXX-XX',
                                address: 'Endereço completo',
                            },
                        },
                        {
                            object: 'Party',
                            value: {
                                role: 'contracted',
                                name: 'Nome do Contratado',
                                document: 'CPF XXX.XXX.XXX-XX',
                                address: 'Endereço completo',
                            },
                        },
                    ],
                },
                {
                    object: 'Clause',
                    value: {
                        number: 1,
                        title: 'Objeto do Contrato',
                        content: 'Descreva aqui o objeto do contrato...',
                    },
                },
                {
                    object: 'Clause',
                    value: {
                        number: 2,
                        title: 'Valor e Forma de Pagamento',
                        content: 'Especifique valores e condições de pagamento...',
                        subclauses: [
                            'Pagamento em X parcelas',
                            'Vencimento no dia Y',
                        ],
                    },
                },
                {
                    object: 'Container',
                    value: [
                        {
                            object: 'Title',
                            value: 'Termos e Condições',
                            level: 3,
                        },
                        {
                            object: 'Term',
                            value: [
                                'Termo ou condição 1',
                                'Termo ou condição 2',
                            ],
                        },
                    ],
                },
                {
                    object: 'Date',
                    value: '2024-01-01',
                    label: 'Data de Assinatura',
                },
            ],
        };
        navigator.clipboard.writeText(JSON.stringify(template, null, 2));
        setCopied(true);
        toast.success(t('templateCopied'));
        setTimeout(() => setCopied(false), 2000);
    }, [t]);

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
                toast.success(t('successSend'));
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (_error) {
                toast.error(t('errorSend'));
            }
        },
        [sendContractMutation, t],
    );

    const handleAccept = useCallback(
        async (contract: ContractDocument) => {
            try {
                await acceptContractMutation.mutateAsync(contract.id);
                toast.success(t('successAccept'));
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (_error) {
                toast.error(t('errorAccept'));
            }
        },
        [acceptContractMutation, t],
    );

    const handleArchive = useCallback(
        async (contract: ContractDocument) => {
            try {
                await archiveContractMutation.mutateAsync(contract.id);
                toast.success(t('successArchive'));
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (_error) {
                toast.error(t('errorArchive'));
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
                    .optional()
                    .or(z.literal('')),
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
                    description: t('projectIdDescription') || 'Projeto vinculado ao contrato',
                    type: 'select' as const,
                    options: projectOptions,
                },
                proposalId: {
                    label: t('proposalId') || 'Proposta',
                    placeholder: t('proposalIdPlaceholder') || 'Selecione uma proposta (opcional)',
                    description:
                        t('proposalIdDescription') || 'Proposta vinculada ao contrato (opcional)',
                    type: 'select' as const,
                    options: proposalOptions,
                },
                name: {
                    label: t('name') || 'Nome',
                    placeholder: t('namePlaceholder') || 'Digite o nome do contrato',
                    description: t('nameDescription') || 'Nome identificador do contrato',
                },
                content: {
                    label: t('content') || 'Conteúdo',
                    placeholder: t('contentPlaceholder') || 'Digite o conteúdo JSON',
                    description: t('contentDescription') || 'Conteúdo do contrato em formato JSON',
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

                    {/* Botões à direita */}
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTemplateModalOpen(true)}
                        >
                            <Sparkles className="mr-2 h-4 w-4" />
                            {t('copyTemplate')}
                        </Button>
                        <GenericCreateFormModal
                            schema={createContractSchema}
                            fieldConfig={contractFieldConfig}
                            onSubmit={async (data) => {
                                await createContractMutation.mutateAsync(data);
                                queryClient.invalidateQueries({ queryKey: ['contract-documents'] });
                            }}
                            onSuccess={() => {
                                toast.success(t('successCreate'));
                            }}
                            onError={() => {
                                toast.error(t('errorCreate'));
                            }}
                            title={t('createTitle')}
                            description={t('createDescription')}
                            trigger={
                                <Button variant="default" size="sm">
                                    {t('createNew')}
                                </Button>
                            }
                            submitLabel={t('createNew')}
                            closeOnsuccess
                        />
                    </div>
                </div>
            </DataTable>

            <Modal
                title={t('templateModalTitle') || 'Template JSON - Criar Contrato'}
                description={t('templateModalDescription') || 'Use este template para criar o JSON do contrato'}
                open={templateModalOpen}
                onOpenChange={(open) => {
                    setTemplateModalOpen(open);
                }}
            >
                <Textarea
                    value={JSON.stringify({
                        version: '1.0',
                        components: [
                            {
                                object: 'Title',
                                value: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS',
                                level: 1,
                            },
                            {
                                object: 'Container',
                                value: [
                                    {
                                        object: 'Title',
                                        value: 'Partes Contratantes',
                                        level: 3,
                                    },
                                    {
                                        object: 'Party',
                                        value: {
                                            role: 'contractor',
                                            name: 'Nome da Empresa Contratante',
                                            document: 'CNPJ XX.XXX.XXX/XXXX-XX',
                                            address: 'Endereço completo',
                                        },
                                    },
                                    {
                                        object: 'Party',
                                        value: {
                                            role: 'contracted',
                                            name: 'Nome do Contratado',
                                            document: 'CPF XXX.XXX.XXX-XX',
                                            address: 'Endereço completo',
                                        },
                                    },
                                ],
                            },
                            {
                                object: 'Clause',
                                value: {
                                    number: 1,
                                    title: 'Objeto do Contrato',
                                    content: 'Descreva aqui o objeto do contrato...',
                                },
                            },
                            {
                                object: 'Clause',
                                value: {
                                    number: 2,
                                    title: 'Valor e Forma de Pagamento',
                                    content: 'Especifique valores e condições de pagamento...',
                                    subclauses: [
                                        'Pagamento em X parcelas',
                                        'Vencimento no dia Y',
                                    ],
                                },
                            },
                            {
                                object: 'Container',
                                value: [
                                    {
                                        object: 'Title',
                                        value: 'Termos e Condições',
                                        level: 3,
                                    },
                                    {
                                        object: 'Term',
                                        value: [
                                            'Termo ou condição 1',
                                            'Termo ou condição 2',
                                        ],
                                    },
                                ],
                            },
                            {
                                object: 'Date',
                                value: '2024-01-01',
                                label: 'Data de Assinatura',
                            },
                        ],
                    }, null, 2)}
                    readOnly
                    rows={20}
                    className="font-mono text-xs resize-none"
                />
                <Button onClick={handleCopyTemplate} className="w-full">
                    {copied ? (
                        <>
                            <Check className="mr-2 h-4 w-4" />
                            {t('copied') || 'Copiado!'}
                        </>
                    ) : (
                        <>
                            <Copy className="mr-2 h-4 w-4" />
                            {t('copyTemplate')}
                        </>
                    )}
                </Button>
            </Modal>
        </Container>
    );
}
