'use client';

import { useTranslation } from "@/hooks/use-translation";
import {
  useProposals,
  useCreateProposal,
  useUpdateProposal,
  useArchiveProposal,
  useDuplicateProposal,
} from "@/lib/actions/proposal/queries";
import { useCompanys } from "@/lib/actions/company/queries";
import { useState, useCallback, useMemo } from 'react';
import { DataTable } from "@/components/data-table";
import { getProposalColumns } from "./proposal-columns";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormBuilderModal, type FormBuilderField } from "@/components/form/form-builder";
import type { Proposal } from "@/lib/actions/proposal/types";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { PROPOSAL_STATUSES, proposalStatusLabelKey } from "@/lib/vocabulary";

// Sentinel do Select: Radix não aceita `value=""` num `SelectItem` — "sem empresa" precisa de
// um valor não-vazio próprio, convertido de volta a `undefined` no submit.
const NO_COMPANY = '__none__';

export function ProposalTab() {
  const { t } = useTranslation('proposal');
  const { t: tVocabulary } = useTranslation('vocabulary');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [archivingProposal, setArchivingProposal] = useState<Proposal | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const queryParams = {
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    pagination: true,
    ...(globalFilter && { search: globalFilter }),
    ...(Object.keys(filters).length > 0 && { filter: JSON.stringify(filters) }),
  };

  const { data, error } = useProposals(queryParams);
  const { data: companiesData } = useCompanys({ pagination: false });
  const companies = useMemo(
    () => (Array.isArray(companiesData) ? companiesData : companiesData?.data ?? []),
    [companiesData],
  );

  const createProposalMutation = useCreateProposal();
  const updateProposalMutation = useUpdateProposal();
  const archiveProposalMutation = useArchiveProposal();
  const duplicateProposalMutation = useDuplicateProposal();

  const handleArchive = useCallback((item: Proposal) => {
    setArchivingProposal(item);
  }, []);

  const handleDuplicate = useCallback(
    (item: Proposal) => {
      duplicateProposalMutation.mutate(item.id);
    },
    [duplicateProposalMutation],
  );

  const createProposalSchema = useMemo(() =>
    z.object({
      name: z.string().min(1, t('nameRequired')),
      companyId: z.string().optional(),
    }),
  [t]);

  const createProposalFields = useMemo<FormBuilderField[]>(() => [
    { name: 'name', label: t('name'), placeholder: t('namePlaceholder') },
    {
      name: 'companyId',
      label: t('company'),
      type: 'select',
      placeholder: t('companyPlaceholder'),
      options: [
        { value: NO_COMPANY, label: t('noCompany') },
        ...companies.map((company) => ({ value: company.id, label: company.name })),
      ],
    },
  ], [t, companies]);

  const columns = useMemo(() =>
    getProposalColumns({ t, tVocabulary, onDuplicate: handleDuplicate, onArchive: handleArchive }),
    [t, tVocabulary, handleDuplicate, handleArchive]
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        error={error}
        queryKey={['proposals', queryParams]}
        pagination={pagination}
        onPaginationChange={setPagination}
        globalFilter={globalFilter}
        enableGlobalFilter={true}
        onGlobalFilterChange={setGlobalFilter}
        filters={filters}
        onFiltersChange={setFilters}
        searchPlaceholder={t('searchPlaceholder')}
        emptyMessage={t('empty')}
        entityName={t('entity')}
        entityNamePlural={t('entityPlural')}
      >
        <DataTable.Input
          title={t('searchText')}
          placeholder={t('searchPlaceholder')}
        />
        <DataTable.Select
          title={t('filterByStatus')}
          accessorKey="status"
          placeholder={t('filterByStatus')}
          options={PROPOSAL_STATUSES.map((status) => ({
            value: status,
            label: tVocabulary(proposalStatusLabelKey(status)),
          }))}
        />
        <DataTable.Actions className="sm:justify-end sm:w-full">
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus /> {t('newProposal')}
          </Button>
        </DataTable.Actions>
      </DataTable>

      <FormBuilderModal
        size="md"
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        title={t('createNewProposal')}
        description={t('createProposalDescription')}
        schema={createProposalSchema}
        fields={createProposalFields}
        mode="create"
        onSubmit={async (data) => {
          const proposal = await createProposalMutation.mutateAsync({ name: data.name });

          if (data.companyId && data.companyId !== NO_COMPANY) {
            try {
              await updateProposalMutation.mutateAsync({
                id: proposal.id,
                data: { companyId: data.companyId },
              });
            } catch {
              // Nada é porta — a proposta já existe, segue sem empresa.
            }
          }

          return proposal;
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['proposals'] });
        }}
        onError={(error) => {
          console.error('Error creating proposal:', error);
        }}
        submitLabel={t('create')}
      />

      <ConfirmDialog
        open={!!archivingProposal}
        onOpenChange={(open) => !open && setArchivingProposal(null)}
        title={t('archiveConfirm')}
        description={archivingProposal ? `${t('archiveConfirmDescription')} "${archivingProposal.name}"?` : ''}
        confirmLabel={t('archive')}
        confirmVariant="destructive"
        onConfirm={async () => {
          if (!archivingProposal) return;
          await archiveProposalMutation.mutateAsync(archivingProposal.id);
          setArchivingProposal(null);
        }}
      />
    </>
  )
}
