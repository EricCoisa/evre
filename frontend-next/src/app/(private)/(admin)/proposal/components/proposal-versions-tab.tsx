'use client';

import { useMemo, useState } from 'react';
import Modal from '@/components/modal';
import { DataTable } from '@/components/data-table';
import { getProposalVersionColumns } from './proposal-version-columns';
import { useTranslation } from '@/hooks/use-translation';
import { useProposalVersions } from '@/lib/actions/proposal/queries';
import type { Proposal, ProposalVersionDto } from '@/lib/actions/proposal/types';
import type { PageRenderContext } from '@/lib/page-builder/page-render-context';
import { LayoutBody } from '@/lib/page-builder/renderer';
import { parseRecordLayout } from '@/lib/page-builder/schema';

function toProposalTerms(version: ProposalVersionDto): PageRenderContext {
  return {
    totalCents: version.totalCents,
    currency: version.currency,
    recurrence: version.recurrence,
    termDays: version.termDays,
    validUntil: version.validUntil,
    includedItems: version.includedItems,
    optionalItems: version.optionalItems,
    published: true,
  };
}

/** Aba `versoes`: cada versão é o snapshot imutável gravado na publicação — editar o rascunho
 * depois não altera o que está aqui. "Abrir" reaproveita o mesmo `LayoutBody` da aba `conteudo`,
 * só em leitura, sem fazer nenhuma chamada nova (a lista já vem com o `layout` inteiro). */
export function ProposalVersionsTab({ proposal }: { proposal: Proposal }) {
  const { t } = useTranslation('proposal');
  const { t: tVocabulary } = useTranslation('vocabulary');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 });
  const { data, error } = useProposalVersions(proposal.id);
  const [previewVersion, setPreviewVersion] = useState<ProposalVersionDto | null>(null);

  const columns = useMemo(
    () => getProposalVersionColumns({ t, tVocabulary, onView: setPreviewVersion }),
    [t, tVocabulary],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        error={error}
        queryKey={['proposal', proposal.id, 'versions']}
        pagination={pagination}
        onPaginationChange={setPagination}
        emptyMessage={t('noVersionsYet')}
      />

      <Modal
        open={previewVersion !== null}
        onOpenChange={(open) => !open && setPreviewVersion(null)}
        title={previewVersion ? t('versionPreviewTitle', { version: previewVersion.version }) : ''}
        size="2xl"
      >
        {previewVersion && (
          <LayoutBody
            layout={parseRecordLayout(previewVersion.layout)}
            profile="proposal"
            proposalTerms={toProposalTerms(previewVersion)}
          />
        )}
      </Modal>
    </>
  );
}
