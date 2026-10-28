'use client';

import { useState } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { Eye } from 'lucide-react';
import { Badge, type badgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Modal from '@/components/modal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTranslation } from '@/hooks/use-translation';
import { useProposalVersions } from '@/lib/actions/proposal/queries';
import type { Proposal, ProposalVersionDto } from '@/lib/actions/proposal/types';
import { formatCents, formatDate } from '@/lib/utils';
import { publicationStateLabelKey, type PublicationState } from '@/lib/vocabulary';
import { EMPTY_LAYOUT } from '@/lib/page-builder/editor/mutations';
import type { ProposalTerms } from '@/lib/page-builder/proposal-terms-context';
import { LayoutBody } from '@/lib/page-builder/renderer';
import { PageLayoutSchema, type PageLayout } from '@/lib/page-builder/schema';

const STATE_BADGE_VARIANT: Record<PublicationState, VariantProps<typeof badgeVariants>['variant']> = {
  ACTIVE: 'default',
  EXPIRED: 'outline',
  REVOKED: 'destructive',
  NONE: 'secondary',
};

function parseVersionLayout(raw: unknown): PageLayout {
  const parsed = PageLayoutSchema.safeParse(raw);
  return parsed.success ? parsed.data : EMPTY_LAYOUT;
}

function toProposalTerms(version: ProposalVersionDto): ProposalTerms {
  return {
    totalCents: version.totalCents,
    currency: version.currency,
    recurrence: version.recurrence,
    termDays: version.termDays,
    validUntil: version.validUntil,
    includedItems: version.includedItems,
    optionalItems: version.optionalItems,
  };
}

/** Aba `versoes`: cada versão é o snapshot imutável gravado na publicação — editar o rascunho
 * depois não altera o que está aqui. "Abrir" reaproveita o mesmo `LayoutBody` da aba `conteudo`,
 * só em leitura, sem fazer nenhuma chamada nova (a lista já vem com o `layout` inteiro). */
export function ProposalVersionsTab({ proposal }: { proposal: Proposal }) {
  const { t } = useTranslation('proposal');
  const { t: tVocabulary } = useTranslation('vocabulary');
  const { data: versions = [], isLoading } = useProposalVersions(proposal.id);
  const [previewVersion, setPreviewVersion] = useState<ProposalVersionDto | null>(null);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{t('loadingVersions')}</p>;
  }

  if (versions.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{t('noVersionsYet')}</p>;
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('versionNumber')}</TableHead>
            <TableHead>{t('versionPublishedAt')}</TableHead>
            <TableHead>{t('value')}</TableHead>
            <TableHead>{t('status')}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {versions.map((version) => (
            <TableRow key={version.id}>
              <TableCell>v{version.version}</TableCell>
              <TableCell>{version.publishedAt ? formatDate(version.publishedAt) : '-'}</TableCell>
              <TableCell>{formatCents(version.totalCents, version.currency)}</TableCell>
              <TableCell>
                <Badge variant={STATE_BADGE_VARIANT[version.state as PublicationState]}>
                  {tVocabulary(publicationStateLabelKey(version.state))}
                </Badge>
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => setPreviewVersion(version)}>
                  <Eye className="size-4 mr-1.5" />
                  {t('viewVersion')}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Modal
        open={previewVersion !== null}
        onOpenChange={(open) => !open && setPreviewVersion(null)}
        title={previewVersion ? t('versionPreviewTitle', { version: previewVersion.version }) : ''}
        size="2xl"
      >
        {previewVersion && (
          <LayoutBody
            layout={parseVersionLayout(previewVersion.layout)}
            profile="proposal"
            proposalTerms={toProposalTerms(previewVersion)}
          />
        )}
      </Modal>
    </>
  );
}
