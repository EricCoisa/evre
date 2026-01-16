'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Proposal } from '@/lib/actions/proposal/types';
import { ProposalRenderer } from '@/app/proposal-public/components';


interface ApproveActionProps {
  proposal: Proposal;
}

export function ProposalClient({ proposal }: ApproveActionProps) {
  return (
    <div className="p-2 max-w-4xl mx-auto">
      <div className="space-y-3 md:space-y-6">
        {/* Content Card com Tabs */}
        <ProposalRenderer content={proposal.content} />

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Informações</CardTitle>
            <CardDescription>Detalhes da proposta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">ID da Proposta</p>
                <p className="text-sm font-mono">{proposal.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Versão</p>
                <p className="text-sm">{proposal.contentSchemaVersion}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Criado em</p>
                <p className="text-sm">
                  {new Date(proposal.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Atualizado em</p>
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
