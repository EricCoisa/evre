'use server';

import { getPublicProposal } from '@/lib/actions/proposal/api';
import { ProposalClient } from './components/proposal-client';

export default async function PublicProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const propostal = await getPublicProposal(id);

  console.log('Propostal data:', propostal);
  if (!propostal?.data) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Proposta não encontrada</h1>
          <p className="mt-4 text-muted-foreground">A proposta que você está procurando não existe ou foi removida.</p>
        </div>
      </div>
    );
  }


  return (
    <ProposalClient proposal={propostal.data} />
  )
 
}
