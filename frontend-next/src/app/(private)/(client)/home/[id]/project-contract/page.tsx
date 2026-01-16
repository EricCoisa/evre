'use server';

import { ContractClient } from './components/contract-client';
import LangLabel from '@/components/ui/langLabel';
import { getApprovedContractDocumentsByProject } from '@/lib/actions/contract-document/api';

export default async function ProjectContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const propostal = await getApprovedContractDocumentsByProject(id);
  if (!propostal?.data) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold"><LangLabel text='contract_not_found' langJson='projectContract' /></h1>
          <p className="mt-4 text-muted-foreground"><LangLabel text='contract_not_found_description' langJson='projectContract' /></p>
        </div>
      </div>
    );
  }


  return (
    <ContractClient contract={propostal.data} />
  )
 
}
