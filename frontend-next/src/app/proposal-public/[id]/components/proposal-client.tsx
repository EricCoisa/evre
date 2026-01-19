'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { approveProposal } from '@/lib/actions/proposal/api';
import { Proposal } from '@/lib/actions/proposal/types';
import { ProposalRenderer } from '../../components';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface ApproveActionProps {
  proposal: Proposal;

}

export function ProposalClient({ proposal }: ApproveActionProps) {
  const router = useRouter();
  const [onApprove, setOnApprove] = useState(false);

  const handleApprove = async () => {
    setOnApprove(true);
    try {
      await approveProposal(proposal.id);
      toast.success('Proposta aprovada com sucesso!');

      // Aguarda 3 segundos e atualiza a página
      setTimeout(() => {
        router.refresh();
      }, 3000);
    } catch (error) {
      toast.error('Erro ao aprovar proposta');
    }
  };

  const canApprove = proposal.status === 'SENT';
  const isApproved = proposal.status === 'APPROVED';

  return (
    <>
      <header className="bg-foreground h-min-[150px] mb-6 shadow-md">
        <div className="p-2 max-w-4xl mx-auto">
          <div className="flex flex-row items-center gap-4 md:gap-6">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight drop-shadow-lg text-white">EVRE</h1>
            <span className="text-base md:text-lg font-semibold text-muted-foreground whitespace-nowrap border-l-2 border-accent pl-4 text-white">Software House</span>
          </div>
        </div>
      </header>
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
                  <p className="text-sm font-medium text-muted-foreground">Versão</p>
                  <p className="text-sm">{proposal.contentSchemaVersion}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Criado em</p>
                  <p className="text-sm">
                    {new Date(proposal.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          {canApprove && (
            <Card>
              <CardHeader>
                <CardTitle>Aprovar Proposta</CardTitle>
                <CardDescription>
                  Ao aprovar, a proposta será marcada como aprovada e não poderá mais ser alterada.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  size="lg"
                  onClick={handleApprove}
                  disabled={onApprove}
                  className="w-full md:w-auto"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Aprovar Proposta
                </Button>
              </CardContent>
            </Card>
          )}

          {isApproved && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-800">Proposta Aprovada</CardTitle>
                <CardDescription className="text-green-700">
                  Esta proposta já foi aprovada, entraremos em contato em breve!.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
