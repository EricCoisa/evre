import { ItemNotFound } from '@/components/ui/item-not-found';
import { getPublicProposal } from '@/lib/actions/proposal-public/api';
import { ProposalUnavailable } from './components/proposal-unavailable';
import { PublicProposalView } from './components/public-proposal-view';

function renewalReason(errors: unknown): 'REVOKED' | 'EXPIRED' | null {
  const reason = (errors as { reason?: string } | undefined)?.reason;
  return reason === 'REVOKED' || reason === 'EXPIRED' ? reason : null;
}

/** Server Component — busca no servidor e renderiza, sem sessão nem `serverMe()`: é a única
 * tela deste produto aberta por quem não tem conta. `LayoutBody` (dentro de `PublicProposalView`)
 * não depende de hook autenticado — ver `f0-02-layout-profile.md`. */
export default async function PublicProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const response = await getPublicProposal(token);

  if (!response.success || !response.data) {
    const reason = renewalReason(response.errors);
    if (reason) {
      return <ProposalUnavailable token={token} reason={reason} />;
    }
    // Token inexistente: página genérica, sem distinguir de revogada (sem enumeração de token).
    return <ItemNotFound itemName="proposta" returnPage="/" returnLabel="Início" />;
  }

  return <PublicProposalView token={token} proposal={response.data} />;
}
