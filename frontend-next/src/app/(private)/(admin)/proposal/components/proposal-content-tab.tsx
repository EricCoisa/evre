'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { useUpdateProposalLayout } from '@/lib/actions/proposal/queries';
import type { Proposal } from '@/lib/actions/proposal/types';
import type { ProposalTerms } from '@/lib/page-builder/proposal-terms-context';
import { LayoutBody } from '@/lib/page-builder/renderer';
import { parseRecordLayout } from '@/lib/page-builder/schema';

// Import dinâmico: mesma técnica do PageRenderer — mantém dnd-kit fora do bundle de quem só visualiza.
const PageEditor = dynamic(() => import('@/lib/page-builder/editor/editor'), { ssr: false });

function toProposalTerms(proposal: Proposal): ProposalTerms {
  return {
    totalCents: proposal.totalCents,
    currency: proposal.currency,
    recurrence: proposal.recurrence,
    termDays: proposal.termDays,
    validUntil: proposal.validUntil,
    includedItems: proposal.includedItems,
    optionalItems: proposal.optionalItems,
    published: false,
  };
}

/** Aba `conteudo`: editor do PageBuilder com `profile="proposal"` e persistência em registro
 * próprio (`PUT proposal/:id/layout`), não em User/SystemConfiguration. Só edita em DRAFT — o
 * backend recusa (`proposal.cannot_edit_non_draft`), aqui o motivo já aparece antes do clique.
 * `onEditingChange` avisa a página quando o modo de edição entra/sai, para a sub-nav esconder a
 * sidebar e o editor ganhar a largura inteira (A5). */
export function ProposalContentTab({
  proposal,
  onEditingChange,
}: {
  proposal: Proposal;
  onEditingChange?: (editing: boolean) => void;
}) {
  const { t } = useTranslation('proposal');
  const [editing, setEditing] = useState(false);
  const updateLayout = useUpdateProposalLayout();
  const layout = parseRecordLayout(proposal.layout);
  const isDraft = proposal.status === 'DRAFT';

  useEffect(() => {
    onEditingChange?.(editing);
  }, [editing, onEditingChange]);

  if (editing) {
    return (
      <PageEditor
        pageKey={`proposal/${proposal.id}`}
        profile="proposal"
        recordId={proposal.id}
        initial={layout}
        proposalTerms={toProposalTerms(proposal)}
        saving={updateLayout.isPending}
        onSave={(nextLayout) => {
          updateLayout.mutate(
            { id: proposal.id, data: { layout: nextLayout } },
            {
              onSuccess: () => {
                toast.success(t('layoutSaved'));
                setEditing(false);
              },
            },
          );
        }}
        onExit={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {!isDraft && (
        <Alert>
          <AlertTitle>{t('contentLockedTitle')}</AlertTitle>
          <AlertDescription>{t('contentLockedDescription')}</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={!isDraft}>
          <Pencil className="size-3.5" />
          {t('editContent')}
        </Button>
      </div>
      {layout.blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('contentEmpty')}</p>
      ) : (
        <LayoutBody layout={layout} profile="proposal" proposalTerms={toProposalTerms(proposal)} />
      )}
    </div>
  );
}
