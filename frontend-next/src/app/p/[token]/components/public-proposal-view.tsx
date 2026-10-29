'use client';

import { useTranslation } from '@/hooks/use-translation';
import { LayoutBody } from '@/lib/page-builder/renderer';
import { parseRecordLayout } from '@/lib/page-builder/schema';
import type { ProposalTerms } from '@/lib/page-builder/proposal-terms-context';
import type { PublicProposalDto } from '@/lib/generated/schemas';
import { formatDateOnly } from '@/lib/utils';
import { ProposalAcceptanceForm } from './proposal-acceptance-form';

/** Render anônimo: `LayoutBody` não busca nada (ver `f0-02-layout-profile.md`) — só desenha o
 * layout que já chegou pronto no servidor. */
export function PublicProposalView({
  token,
  proposal,
}: {
  token: string;
  proposal: PublicProposalDto;
}) {
  const { t } = useTranslation('proposal');
  const layout = parseRecordLayout(proposal.layout);
  const validUntil = proposal.envelope.validUntil ? formatDateOnly(proposal.envelope.validUntil) : null;
  const terms: ProposalTerms = {
    totalCents: proposal.envelope.totalCents,
    currency: proposal.envelope.currency,
    recurrence: proposal.envelope.recurrence,
    termDays: proposal.envelope.termDays,
    validUntil: proposal.envelope.validUntil,
    includedItems: proposal.envelope.includedItems,
    optionalItems: proposal.envelope.optionalItems,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="space-y-1 border-b pb-4">
        <h1 className="text-2xl font-bold text-foreground">{proposal.proposalName}</h1>
        {proposal.companyName ? (
          <p className="text-sm text-muted-foreground">{proposal.companyName}</p>
        ) : null}
        {validUntil ? (
          <p className="text-sm font-semibold text-foreground">
            {t('validUntil')}: {validUntil}
          </p>
        ) : null}
      </header>
      {layout.blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('contentEmpty')}</p>
      ) : (
        <LayoutBody layout={layout} profile="proposal" proposalTerms={terms} />
      )}
      <ProposalAcceptanceForm
        token={token}
        envelope={proposal.envelope}
        initialAcceptedAt={proposal.acceptedAt}
      />
    </div>
  );
}
