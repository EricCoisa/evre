'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Proposal } from '@/lib/actions/proposal/types';
import { ProposalRenderer } from '@/app/proposal-public/components';
import { useTranslation } from '@/hooks/use-translation';


interface ApproveActionProps {
  proposal: Proposal;
}

export function ProposalClient({ proposal }: ApproveActionProps) {
  const { t } = useTranslation('projectProposal');
  
  return (
    <div className="p-2 max-w-4xl mx-auto">
      <div className="space-y-3 md:space-y-6">
        {/* Content Card com Tabs */}
        <ProposalRenderer content={proposal.content} />

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('info_title')}</CardTitle>
            <CardDescription>{t('info_description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('proposal_id')}</p>
                <p className="text-sm font-mono">{proposal.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('proposal_version')}</p>
                <p className="text-sm">{proposal.contentSchemaVersion}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('proposal_created_at')}</p>
                <p className="text-sm">
                  {new Date(proposal.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('proposal_updated_at')}</p>
                <p className="text-sm">
                  {new Date(proposal.updatedAt).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
