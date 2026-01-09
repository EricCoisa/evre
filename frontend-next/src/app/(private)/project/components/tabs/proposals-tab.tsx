"use client";

import { useProposalsByCompany } from '@/lib/actions/proposal/queries';
import { DataTable } from '@/components/data-table';
import { getProposalColumns } from '@/app/(private)/proposal/components/proposal-columns';
import { useTranslation } from 'react-i18next';
import { useCallback, useMemo, useState } from 'react';
import { Project } from '@/lib/actions/project/types';
import { Proposal } from '@/lib/actions/proposal/types';
import { useRouter } from 'next/navigation';

interface ProposalsTabProps {
    project: Project;
}

export function ProposalsTab({ project }: ProposalsTabProps) {
    const { t } = useTranslation('proposal');
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
    const [globalFilter, setGlobalFilter] = useState('');
    const [filters, setFilters] = useState<Record<string, string>>({});
    const router = useRouter();

    // Supondo que project.companyId existe
    const { data, error } = useProposalsByCompany(project.companyId);


    const handleView = useCallback((proposal: Proposal) => {
        router.push(`/proposal/${proposal.id}`);
    }, [router]);

    const columns = useMemo(() => getProposalColumns({ t, onView: handleView }), [t, handleView]);
    return (
        <DataTable
            columns={columns}
            data={data}
            error={error}
            queryKey={['proposals', project.companyId]}
            pagination={pagination}
            onPaginationChange={setPagination}
            globalFilter={globalFilter}
            onGlobalFilterChange={setGlobalFilter}
            filters={filters}
            onFiltersChange={setFilters}
            enableGlobalFilter={true}
            searchPlaceholder={t('searchPlaceholder') || 'Buscar propostas...'}
            loadingMessage={t('loading') || 'Carregando...'}
            emptyMessage={t('noProposals') || 'Nenhuma proposta encontrada'}
            entityName={t('entity') || 'proposta'}
            entityNamePlural={t('entityPlural') || 'propostas'}
        />
    );
}
