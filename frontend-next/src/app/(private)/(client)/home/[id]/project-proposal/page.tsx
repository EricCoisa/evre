'use server';

import { getProposalByProject } from '@/lib/actions/proposal/api';
import { ProposalClient } from './components/proposal-client';
import LangLabel from '@/components/ui/langLabel';

export default async function ProjectProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const propostal = await getProposalByProject(id);

  if (!propostal?.data) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold"><LangLabel text='proposal_not_found' langJson='projectProposal' /></h1>
          <p className="mt-4 text-muted-foreground"><LangLabel text='proposal_not_found_description' langJson='projectProposal' /></p>
        </div>
      </div>
    );
  }


  return (
    <ProposalClient proposal={propostal.data} />
  )
 
}
