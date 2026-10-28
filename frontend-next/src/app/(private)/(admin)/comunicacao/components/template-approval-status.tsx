'use client';

import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-translation';
import type { MessagingTemplateCatalogItem } from '@/lib/actions/messaging/types';
import type { MessagingConnection } from '@/lib/actions/messaging/types';
import { connectionDisplayName } from '@/lib/messaging/connection';

type Submission = NonNullable<MessagingTemplateCatalogItem['submissions']>[number];

const VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  APPROVED: 'default',
  PENDING: 'secondary',
  REJECTED: 'destructive',
  PAUSED: 'outline',
  DISABLED: 'destructive',
};

/** Motivos de reprovação da Meta (`rejected_reason`) que valem tradução; o resto aparece como veio. */
const KNOWN_REASONS = [
  'ABUSIVE_CONTENT',
  'INCORRECT_CATEGORY',
  'INVALID_FORMAT',
  'SCAM',
  'TAG_CONTENT_MISMATCH',
];

/** Status de cada submissão do template (uma por conexão), com o motivo quando a Meta não aprovou. */
export function TemplateApprovalStatus({
  submissions,
  connections,
}: {
  submissions: Submission[] | undefined;
  connections: MessagingConnection[];
}) {
  const { t } = useTranslation('messaging');

  if (!submissions?.length) {
    return <span className="text-sm text-muted-foreground">{t('approval.NOT_SUBMITTED')}</span>;
  }

  return (
    <div className="grid gap-1.5">
      {submissions.map((submission) => {
        const connection = connections.find((c) => c.id === submission.connectionId);
        const reason = submission.reason
          ? KNOWN_REASONS.includes(submission.reason)
            ? t(`approvalReason.${submission.reason}`)
            : submission.reason
          : null;
        return (
          <div key={submission.connectionId} className="grid gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={VARIANT[submission.status] ?? 'outline'}>
                {t(`approval.${submission.status}`, { defaultValue: submission.status })}
              </Badge>
              {connections.length > 1 && connection && (
                <span className="text-xs text-muted-foreground">{connectionDisplayName(connection)}</span>
              )}
            </div>
            {submission.outOfSync && (
              <p className="max-w-xs whitespace-normal text-xs text-amber-600 dark:text-amber-400" title={t('outOfSyncHint')}>
                ⚠ {t('outOfSyncBadge')}
              </p>
            )}
            {reason && submission.status !== 'APPROVED' && (
              <p className="max-w-xs whitespace-normal text-xs text-destructive">{reason}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
