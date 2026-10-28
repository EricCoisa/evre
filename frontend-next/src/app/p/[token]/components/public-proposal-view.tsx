'use client';

import { useTranslation } from '@/hooks/use-translation';
import { SITE_NAME } from '@/lib/site';
import { EMPTY_LAYOUT } from '@/lib/page-builder/editor/mutations';
import { LayoutBody } from '@/lib/page-builder/renderer';
import { PageLayoutSchema, type PageLayout } from '@/lib/page-builder/schema';
import type { ProposalTerms } from '@/lib/page-builder/proposal-terms-context';
import type { PublicProposalDto } from '@/lib/generated/schemas';
import { ProposalAcceptanceForm } from './proposal-acceptance-form';

/** `proposal.layout` já chega como o `PageLayout` puro — mesma leitura defensiva de
 * `proposal-content-tab.tsx` (storage: 'record', sem o mapa `{ [pageKey]: layout }`). */
function parsePublicLayout(raw: unknown): PageLayout {
  const parsed = PageLayoutSchema.safeParse(raw);
  return parsed.success ? parsed.data : EMPTY_LAYOUT;
}

function formatValidUntil(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('pt-BR').format(date);
}

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
  const layout = parsePublicLayout(proposal.layout);
  const validUntil = formatValidUntil(proposal.envelope.validUntil);
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
        <p className="text-sm font-medium text-muted-foreground">{SITE_NAME}</p>
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
