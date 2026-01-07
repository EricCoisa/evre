import { getProposal } from '@/lib/actions/proposal/api';
import { ProposalDetailClient } from './components/proposal-detail-client';
export default async function ProposalDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const { data: proposal } = await getProposal(id);
  console.log('Proposal data:', proposal);
  
  if (!proposal) {
    return (
      <div>
        <div className="text-center py-8">
          <h1 className="text-2xl font-bold">Proposta não encontrada</h1>
          <p className="mt-4 text-muted-foreground">
            A proposta que você está procurando não existe ou foi removida.
          </p>
        </div>
      </div>
    );
  }

  return <ProposalDetailClient proposal={proposal} />;
}
