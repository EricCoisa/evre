'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from "@/hooks/use-translation";
import { useProposals } from "@/lib/actions/proposal/queries";
import { DataTable } from "@/components/data-table";
import { getProposalColumns } from "../../../proposal/components/proposal-columns";

interface CompanyProposalsTabProps {
  companyId: string;
}

/** Aba propostas: lista as propostas da empresa, reusando as colunas da tela `/proposal`. */
export function CompanyProposalsTab({ companyId }: CompanyProposalsTabProps) {
  const { t } = useTranslation('proposal');
  const { t: tVocabulary } = useTranslation('vocabulary');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const queryParams = useMemo(
    () => ({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      pagination: true,
      filter: { companyId },
    }),
    [pagination, companyId],
  );

  const { data, error } = useProposals(queryParams);

  const columns = useMemo(() => getProposalColumns({ t, tVocabulary }), [t, tVocabulary]);

  return (
    <DataTable
      columns={columns}
      data={data}
      error={error}
      queryKey={['proposals', queryParams]}
      pagination={pagination}
      onPaginationChange={setPagination}
      emptyMessage={t('empty')}
      entityName={t('entity')}
      entityNamePlural={t('entityPlural')}
    />
  );
}
