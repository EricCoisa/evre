import { getContractDocument } from '@/lib/actions/contract-document/api';
import { ContractDocumentDetailClient } from './components/contract-document-detail-client';

export default async function ContractDocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: contract } = await getContractDocument(id);

  if (!contract) {
    return (
      <div>
        <div className="text-center py-8">
          <h1 className="text-2xl font-bold">Contrato não encontrado</h1>
          <p className="mt-4 text-muted-foreground">
            O contrato que você está procurando não existe ou foi removido.
          </p>
        </div>
      </div>
    );
  }

  return <ContractDocumentDetailClient contract={contract} />;
}
